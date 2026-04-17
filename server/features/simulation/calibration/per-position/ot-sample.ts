import type { GameResult, PlayEvent } from "../../events.ts";
import type { SimTeam } from "../../simulate-game.ts";
import { otOverall } from "./ot-overall.ts";

// Per-OT game sample. Because the sim engine does not log individual
// OT participation on blocking plays (pass-pro or run-block), the
// "team_sack_allowed_rate" and "team_rush_ypc" fields are populated
// from the team's aggregate performance and shared equally across both
// starting tackles. penalties_per_game is attributed cleanly per-player
// using `event.penalty.againstPlayerId` when present.
//
// This matches the PROXY METRICS v1 caveat in
// data/R/bands/per-position-ot.R and data/bands/per-position/ot.json:
// the sim's team-level protection is our best signal until we log
// per-player block grades.
export interface OtGameSample {
  teamId: string;
  otPlayerId: string;
  otOverall: number;
  // Team-level denominators the OT "shares" with the other starting tackle.
  team_dropbacks: number;
  team_sacks_allowed: number;
  team_rushes: number;
  team_rush_yards: number;
  // Per-player (clean).
  penalties: number;
  // Derived rate metrics (match the NFL fixture's metric keys).
  team_sack_allowed_rate: number;
  team_rush_ypc: number;
  penalties_per_game: number;
  // Participation sanity check: samples are always collected for one
  // game, so this is effectively 1. Kept for parity with the NFL
  // fixture's `starts_per_season` metric.
  starts_per_season: number;
}

const RUN_CONCEPTS = new Set([
  "inside_zone",
  "outside_zone",
  "power",
  "counter",
  "draw",
  "rpo",
]);

interface TeamAggregate {
  dropbacks: number;
  sacksAllowed: number;
  rushes: number;
  rushYards: number;
}

function emptyAgg(): TeamAggregate {
  return { dropbacks: 0, sacksAllowed: 0, rushes: 0, rushYards: 0 };
}

function accumulateTeam(
  events: PlayEvent[],
  teamId: string,
): TeamAggregate {
  const agg = emptyAgg();
  for (const event of events) {
    if (event.offenseTeamId !== teamId) continue;

    switch (event.outcome) {
      case "pass_complete":
      case "pass_incomplete":
      case "interception":
        agg.dropbacks++;
        break;
      case "sack":
        agg.dropbacks++;
        agg.sacksAllowed++;
        break;
      case "touchdown":
        if (RUN_CONCEPTS.has(event.call.concept)) {
          agg.rushes++;
          agg.rushYards += event.yardage;
        } else {
          agg.dropbacks++;
        }
        break;
      case "rush":
        agg.rushes++;
        agg.rushYards += event.yardage;
        break;
      case "fumble":
        // Downstream of a rush in the sim's current outcome model.
        agg.rushes++;
        agg.rushYards += event.yardage;
        break;
      default:
        break;
    }
  }
  return agg;
}

function countPenalties(events: PlayEvent[], playerId: string): number {
  let count = 0;
  for (const event of events) {
    const penalty = event.penalty;
    if (!penalty) continue;
    if (!penalty.accepted) continue;
    if (penalty.againstPlayerId === playerId) count++;
  }
  return count;
}

export interface OtSampleInput {
  game: GameResult;
  home: SimTeam;
  away: SimTeam;
}

// Emit one OtGameSample per starting tackle on each team. Teams carry
// two OT starters by design (see STARTER_SLOTS in
// generate-calibration-league.ts), so this produces up to four samples
// per game — two per side. Team-level denominators are shared; each
// tackle's penalties are tallied from `penalty.againstPlayerId`.
export function collectOtSamples(
  input: OtSampleInput,
): OtGameSample[] {
  const { game, home, away } = input;

  const samples: OtGameSample[] = [];
  for (const team of [home, away]) {
    const tackles = team.starters.filter((p) => p.neutralBucket === "OT");
    if (tackles.length === 0) continue;

    const teamAgg = accumulateTeam(game.events, team.teamId);
    const team_sack_allowed_rate = teamAgg.dropbacks > 0
      ? teamAgg.sacksAllowed / teamAgg.dropbacks
      : 0;
    const team_rush_ypc = teamAgg.rushes > 0
      ? teamAgg.rushYards / teamAgg.rushes
      : 0;

    for (const ot of tackles) {
      const penalties = countPenalties(game.events, ot.playerId);
      samples.push({
        teamId: team.teamId,
        otPlayerId: ot.playerId,
        otOverall: otOverall(ot.attributes),
        team_dropbacks: teamAgg.dropbacks,
        team_sacks_allowed: teamAgg.sacksAllowed,
        team_rushes: teamAgg.rushes,
        team_rush_yards: teamAgg.rushYards,
        penalties,
        team_sack_allowed_rate,
        team_rush_ypc,
        penalties_per_game: penalties,
        starts_per_season: 1,
      });
    }
  }
  return samples;
}
