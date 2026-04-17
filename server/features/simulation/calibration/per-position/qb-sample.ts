import type { GameResult, PlayEvent } from "../../events.ts";
import type { SimTeam } from "../../simulate-game.ts";
import { qbOverall } from "./qb-overall.ts";

export interface QbGameSample {
  teamId: string;
  qbPlayerId: string;
  qbOverall: number;
  attempts: number;
  completions: number;
  pass_yards: number;
  pass_tds: number;
  interceptions: number;
  sacks: number;
  dropbacks: number;
  completion_pct: number;
  yards_per_attempt: number;
  td_rate: number;
  int_rate: number;
  sack_rate: number;
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
  let attempts = 0;
  let completions = 0;
  let passYards = 0;
  let passTds = 0;
  let ints = 0;
  let sacks = 0;

  for (const event of events) {
    if (event.offenseTeamId !== teamId) continue;

    switch (event.outcome) {
      case "pass_complete":
        attempts++;
        completions++;
        passYards += event.yardage;
        break;
      case "pass_incomplete":
        attempts++;
        break;
      case "sack":
        sacks++;
        break;
      case "interception":
        attempts++;
        ints++;
        break;
      case "touchdown":
        // Run-concept TDs are credited to the ball-carrier, not the QB.
        // Pass-concept TDs are completed passes that reached the endzone
        // — count them as attempts + completions + a pass TD, mirroring
        // how `team-game-stats.ts` attributes pass-concept touchdowns.
        if (!RUN_CONCEPTS.has(event.call.concept)) {
          attempts++;
          completions++;
          passYards += event.yardage;
          passTds++;
        }
        break;
      case "fumble":
        // Sack-fumbles are the only fumble attributed to the QB, and
        // they already count as sacks at the outcome level; this
        // `fumble` outcome is downstream from a rush, so skip.
        break;
    }
  }

  const dropbacks = attempts + sacks;
  return {
    attempts,
    completions,
    pass_yards: passYards,
    pass_tds: passTds,
    interceptions: ints,
    sacks,
    dropbacks,
    completion_pct: attempts > 0 ? completions / attempts : 0,
    yards_per_attempt: attempts > 0 ? passYards / attempts : 0,
    td_rate: attempts > 0 ? passTds / attempts : 0,
    int_rate: attempts > 0 ? ints / attempts : 0,
    sack_rate: dropbacks > 0 ? sacks / dropbacks : 0,
  };
}

export interface QbSampleInput {
  game: GameResult;
  home: SimTeam;
  away: SimTeam;
}

// Attribute a team-game's pass stats to the team's starter QB. Real
// games have injury-forced QB changes, but in the calibration league
// QB injuries are essentially non-existent (INJURY_ON_PLAY = 0.005 and
// the QB isn't a logged participant), so the starter carries the full
// workload. If that assumption breaks we can switch to per-event
// attribution once the engine logs the passer as a participant.
export function collectQbSamples(
  input: QbSampleInput,
): QbGameSample[] {
  const { game, home, away } = input;

  const samples: QbGameSample[] = [];
  for (const team of [home, away]) {
    const qb = team.starters.find((p) => p.neutralBucket === "QB");
    if (!qb) continue;

    const stats = accumulate(game.events, team.teamId);
    samples.push({
      teamId: team.teamId,
      qbPlayerId: qb.playerId,
      qbOverall: qbOverall(qb.attributes),
      ...stats,
    });
  }
  return samples;
}
