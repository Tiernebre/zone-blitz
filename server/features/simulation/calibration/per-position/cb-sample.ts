import type { GameResult, PlayEvent } from "../../events.ts";
import type { SimTeam } from "../../simulate-game.ts";
import type { PlayerRuntime } from "../../resolve-play.ts";
import { CB_OVERALL_ATTRS, cbOverall } from "./cb-overall.ts";

export interface CbGameSample {
  teamId: string;
  cbPlayerId: string;
  cbOverall: number;
  // Pass attempts the defense faced during this game — allocated to
  // each CB proportional to coverage-attr share. See `attribute` below
  // for why: the engine logs the covered receiver on each play but
  // does not tag the covering defender on completions/incompletions,
  // so completion%-allowed numbers land on the CB group at the team
  // level and get split by coverage strength.
  targets: number;
  completions_allowed: number;
  yards_allowed: number;
  // Direct per-play attribution — the engine stamps the intercepting
  // defender into `participants` with the `interception` tag.
  interceptions: number;
  // Pass breakups aren't a distinct outcome in the sim; the closest
  // proxy is share of incomplete passes weighted by coverage strength.
  pbus: number;
  // Per-game rate stats. These mirror the CB fixture keys so the
  // calibration harness can compare apples to apples.
  targets_per_game: number;
  completion_allowed_pct: number;
  yards_per_target_allowed: number;
  pbu_rate: number;
  pbus_per_game: number;
  ints_per_game: number;
}

// Share of a CB's coverage attrs out of the CB group's total. Used as
// the weight for team-level target/completion/yardage allocation when
// the engine doesn't tag a specific defender on the event.
function coverageShareByCb(cbs: readonly PlayerRuntime[]): Map<string, number> {
  const shares = new Map<string, number>();
  if (cbs.length === 0) return shares;

  let total = 0;
  const raw = new Map<string, number>();
  for (const cb of cbs) {
    let sum = 0;
    for (const key of CB_OVERALL_ATTRS) {
      sum += cb.attributes[key];
    }
    raw.set(cb.playerId, sum);
    total += sum;
  }

  if (total <= 0) {
    const even = 1 / cbs.length;
    for (const cb of cbs) shares.set(cb.playerId, even);
    return shares;
  }

  for (const [id, value] of raw) shares.set(id, value / total);
  return shares;
}

interface DefensiveAggregate {
  targets: number;
  completionsAllowed: number;
  yardsAllowed: number;
  incompletions: number;
  // Player-ids directly credited with an INT on a route-coverage play.
  directInterceptions: string[];
}

function aggregate(
  events: PlayEvent[],
  defenseTeamId: string,
): DefensiveAggregate {
  let targets = 0;
  let completionsAllowed = 0;
  let yardsAllowed = 0;
  let incompletions = 0;
  const directInterceptions: string[] = [];

  for (const event of events) {
    if (event.defenseTeamId !== defenseTeamId) continue;

    switch (event.outcome) {
      case "pass_complete":
        targets++;
        completionsAllowed++;
        yardsAllowed += event.yardage;
        break;
      case "pass_incomplete":
        targets++;
        incompletions++;
        break;
      case "interception":
        targets++;
        for (const p of event.participants) {
          if (
            p.role === "route_coverage" &&
            p.tags.includes("interception")
          ) {
            directInterceptions.push(p.playerId);
          }
        }
        break;
      case "touchdown": {
        // Pass-concept TDs also count as targets-allowed for the
        // defense. `qb-sample.ts` treats these as completed passes;
        // mirror that here so team-level totals stay consistent.
        const runConcept = new Set([
          "inside_zone",
          "outside_zone",
          "power",
          "counter",
          "draw",
          "rpo",
        ]);
        if (!runConcept.has(event.call.concept)) {
          targets++;
          completionsAllowed++;
          yardsAllowed += event.yardage;
        }
        break;
      }
    }
  }

  return {
    targets,
    completionsAllowed,
    yardsAllowed,
    incompletions,
    directInterceptions,
  };
}

export interface CbSampleInput {
  game: GameResult;
  home: SimTeam;
  away: SimTeam;
}

// Emit one sample per starter CB on each team. Multiple CBs per team
// (typical depth: 2 outside + 1 nickel) — each gets a per-game row
// bucketed by their individual overall. Team-level pass-defense
// totals are split across CBs by coverage-attr share; per-play direct
// credits (interceptions) go to the tagged defender only.
export function collectCbSamples(input: CbSampleInput): CbGameSample[] {
  const { game, home, away } = input;

  const samples: CbGameSample[] = [];
  for (const team of [home, away]) {
    const cbs = team.starters.filter((p) => p.neutralBucket === "CB");
    if (cbs.length === 0) continue;

    const shares = coverageShareByCb(cbs);
    const defense = aggregate(game.events, team.teamId);
    const directIntCounts = new Map<string, number>();
    for (const playerId of defense.directInterceptions) {
      directIntCounts.set(
        playerId,
        (directIntCounts.get(playerId) ?? 0) + 1,
      );
    }

    for (const cb of cbs) {
      const share = shares.get(cb.playerId) ?? 0;
      const targets = defense.targets * share;
      const completions_allowed = defense.completionsAllowed * share;
      const yards_allowed = defense.yardsAllowed * share;
      // PBU proxy: share of incompletions credited to this CB.
      const pbus = defense.incompletions * share;
      const interceptions = directIntCounts.get(cb.playerId) ?? 0;

      samples.push({
        teamId: team.teamId,
        cbPlayerId: cb.playerId,
        cbOverall: cbOverall(cb.attributes),
        targets,
        completions_allowed,
        yards_allowed,
        interceptions,
        pbus,
        targets_per_game: targets,
        completion_allowed_pct: targets > 0 ? completions_allowed / targets : 0,
        yards_per_target_allowed: targets > 0 ? yards_allowed / targets : 0,
        pbu_rate: targets > 0 ? pbus / targets : 0,
        pbus_per_game: pbus,
        ints_per_game: interceptions,
      });
    }
  }
  return samples;
}
