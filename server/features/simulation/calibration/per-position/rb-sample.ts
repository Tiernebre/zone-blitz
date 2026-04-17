import type { GameResult, PlayEvent } from "../../events.ts";
import type { SimTeam } from "../../simulate-game.ts";
import { rbOverall } from "./rb-overall.ts";

export interface RbGameSample {
  teamId: string;
  rbPlayerId: string;
  rbOverall: number;
  carries: number;
  rush_yards: number;
  rush_tds: number;
  fumbles_lost: number;
  yards_per_carry: number;
  rush_td_rate: number;
  yards_per_game: number;
  fumble_rate: number;
}

const RUN_CONCEPTS = new Set([
  "inside_zone",
  "outside_zone",
  "power",
  "counter",
  "draw",
  "rpo",
]);

function accumulate(events: PlayEvent[], teamId: string) {
  let carries = 0;
  let rushYards = 0;
  let rushTds = 0;
  let fumblesLost = 0;

  for (const event of events) {
    if (event.offenseTeamId !== teamId) continue;

    switch (event.outcome) {
      case "rush":
        carries++;
        rushYards += event.yardage;
        break;
      case "fumble":
        // A fumble outcome in the engine is produced downstream of a
        // rush (`synthesize-run-outcome.ts`), so it counts as a carry
        // with whatever yardage the runner had gained before coughing
        // the ball up.
        carries++;
        rushYards += event.yardage;
        fumblesLost++;
        break;
      case "touchdown":
        // Run-concept TDs get credited to the ball carrier. Pass-concept
        // TDs belong to the QB/receiver and are skipped, mirroring how
        // `team-game-stats.ts` splits TDs between the pass and rush
        // sides.
        if (RUN_CONCEPTS.has(event.call.concept)) {
          carries++;
          rushYards += event.yardage;
          rushTds++;
        }
        break;
    }
  }

  return {
    carries,
    rush_yards: rushYards,
    rush_tds: rushTds,
    fumbles_lost: fumblesLost,
    yards_per_carry: carries > 0 ? rushYards / carries : 0,
    rush_td_rate: carries > 0 ? rushTds / carries : 0,
    // One sample spans a single game, so `yards_per_game` is just the
    // rushing yardage. Keeping the name aligned with the NFL band
    // fixture makes the bucket report directly comparable.
    yards_per_game: rushYards,
    fumble_rate: carries > 0 ? fumblesLost / carries : 0,
  };
}

export interface RbSampleInput {
  game: GameResult;
  home: SimTeam;
  away: SimTeam;
}

// Attribute a team-game's rush stats to the team's starter RB. The
// engine's `resolve-matchups.ts` picks `rbs[0]` as the ball carrier on
// every run play, so the starter carries the full workload until
// injured — and calibration injuries are rare enough that backup
// carries don't meaningfully shift per-bucket means. If that
// assumption breaks we can switch to per-participant attribution via
// the `ball_carrier` tag once the engine writes it consistently.
export function collectRbSamples(
  input: RbSampleInput,
): RbGameSample[] {
  const { game, home, away } = input;

  const samples: RbGameSample[] = [];
  for (const team of [home, away]) {
    const rb = team.starters.find((p) => p.neutralBucket === "RB");
    if (!rb) continue;

    const stats = accumulate(game.events, team.teamId);
    samples.push({
      teamId: team.teamId,
      rbPlayerId: rb.playerId,
      rbOverall: rbOverall(rb.attributes),
      ...stats,
    });
  }
  return samples;
}
