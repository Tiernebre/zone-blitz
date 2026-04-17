import type { GameResult, PlayEvent } from "../../events.ts";
import type { SimTeam } from "../../simulate-game.ts";
import { iolOverall } from "./iol-overall.ts";

// Run concepts where the ball carrier goes between the tackles.
// Interior OL "own" these runs for the stuff-rate proxy, mirroring
// how the R script filters pbp rows with run_gap in ("guard","middle").
// Anything not in this set (outside_zone, sweeps, etc.) is attributed
// elsewhere.
const INTERIOR_RUN_CONCEPTS = new Set([
  "inside_zone",
  "power",
  "counter",
  "draw",
]);

export interface IolGameSample {
  teamId: string;
  iolPlayerId: string;
  iolOverall: number;
  // Team-level proxy metrics. Every IOL starter on the same team in
  // the same game sees the same value — calibration gap inherited
  // from the R fixture and documented in the notes.
  team_dropbacks: number;
  team_sacks: number;
  team_sack_allowed_rate: number;
  team_interior_runs: number;
  team_interior_stuffs: number;
  team_stuff_rate_inside: number;
  // Per-player metric. Sourced from penalty events whose
  // `againstPlayerId` matches this lineman.
  penalties: number;
  penalties_per_game: number;
  // Snap/start attribution — each starter counts as having played the
  // game, so this is 1 per sample and aggregates to starts-per-season
  // when rolled up across matchups in a season.
  starts_per_season: number;
}

function teamTotals(events: PlayEvent[], teamId: string) {
  let dropbacks = 0;
  let sacks = 0;
  let interiorRuns = 0;
  let interiorStuffs = 0;

  for (const event of events) {
    if (event.offenseTeamId !== teamId) continue;

    const concept = event.call.concept;
    const isInteriorRun = INTERIOR_RUN_CONCEPTS.has(concept);

    switch (event.outcome) {
      case "sack":
        dropbacks++;
        sacks++;
        break;
      case "pass_complete":
      case "pass_incomplete":
      case "interception":
        dropbacks++;
        break;
      case "rush":
        if (isInteriorRun) {
          interiorRuns++;
          if (event.yardage <= 0) interiorStuffs++;
        }
        break;
      case "fumble":
        // Fumbles that came off a rush still count as an interior run
        // attempt for stuff-rate denominator purposes — they're not
        // stuffs (yardage can be positive at the point of the fumble),
        // so compare on yardage only.
        if (isInteriorRun) {
          interiorRuns++;
          if (event.yardage <= 0) interiorStuffs++;
        }
        break;
      case "touchdown":
        if (isInteriorRun) {
          interiorRuns++;
          // Touchdown runs are definitionally not stuffs.
        } else if (!INTERIOR_RUN_CONCEPTS.has(concept)) {
          // Pass-concept TDs count as a completed dropback.
          dropbacks++;
        }
        break;
    }
  }

  return { dropbacks, sacks, interiorRuns, interiorStuffs };
}

function countPenaltiesFor(events: PlayEvent[], playerId: string): number {
  let n = 0;
  for (const event of events) {
    const penalty = event.penalty;
    if (!penalty) continue;
    if (penalty.againstPlayerId === playerId) {
      n++;
    }
  }
  return n;
}

export interface IolSampleInput {
  game: GameResult;
  home: SimTeam;
  away: SimTeam;
}

// Build one sample per IOL starter on each team per game. Because the
// ranking fixture's team proxies can't distinguish linemen on the same
// line, each starter carries the same team_sack_allowed_rate and
// team_stuff_rate_inside for that game; only `penalties` is per-player.
// This mirrors the R script's team-proxy-broadcast approach and
// documents the aggregation gap explicitly.
export function collectIolSamples(
  input: IolSampleInput,
): IolGameSample[] {
  const { game, home, away } = input;

  const samples: IolGameSample[] = [];
  for (const team of [home, away]) {
    const iolStarters = team.starters.filter(
      (p) => p.neutralBucket === "IOL",
    );
    if (iolStarters.length === 0) continue;

    const totals = teamTotals(game.events, team.teamId);
    const sack_rate = totals.dropbacks > 0
      ? totals.sacks / totals.dropbacks
      : 0;
    const stuff_rate = totals.interiorRuns > 0
      ? totals.interiorStuffs / totals.interiorRuns
      : 0;

    for (const lineman of iolStarters) {
      const penalties = countPenaltiesFor(game.events, lineman.playerId);
      samples.push({
        teamId: team.teamId,
        iolPlayerId: lineman.playerId,
        iolOverall: iolOverall(lineman.attributes),
        team_dropbacks: totals.dropbacks,
        team_sacks: totals.sacks,
        team_sack_allowed_rate: sack_rate,
        team_interior_runs: totals.interiorRuns,
        team_interior_stuffs: totals.interiorStuffs,
        team_stuff_rate_inside: stuff_rate,
        penalties,
        penalties_per_game: penalties,
        starts_per_season: 1,
      });
    }
  }
  return samples;
}
