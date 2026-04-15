import type { GameResult, PlayEvent } from "../events.ts";

export interface TeamGameSample {
  teamId: string;
  plays: number;
  pass_attempts: number;
  rush_attempts: number;
  pass_rate: number;
  rush_rate: number;
  completion_pct: number;
  yards_per_attempt: number;
  yards_per_carry: number;
  pass_yards: number;
  rush_yards: number;
  sacks_taken: number;
  interceptions: number;
  fumbles_lost: number;
  turnovers: number;
  penalties: number;
}

const SKIP_OUTCOMES = new Set([
  "kickoff",
  "kneel",
  "xp",
  "two_point",
  "spike",
]);

const RUN_CONCEPTS = new Set([
  "inside_zone",
  "outside_zone",
  "power",
  "counter",
  "draw",
  "rpo",
]);

function deriveForTeam(
  events: PlayEvent[],
  teamId: string,
): TeamGameSample {
  let plays = 0;
  let passAttempts = 0;
  let rushAttempts = 0;
  let completions = 0;
  let passYards = 0;
  let rushYards = 0;
  let sacksTaken = 0;
  let interceptions = 0;
  let fumblesLost = 0;
  let penalties = 0;

  for (const event of events) {
    if (event.offenseTeamId !== teamId) continue;
    if (SKIP_OUTCOMES.has(event.outcome)) continue;

    plays++;

    switch (event.outcome) {
      case "pass_complete":
        passAttempts++;
        completions++;
        passYards += event.yardage;
        break;
      case "pass_incomplete":
        passAttempts++;
        break;
      case "sack":
        passAttempts++;
        sacksTaken++;
        break;
      case "interception":
        passAttempts++;
        interceptions++;
        break;
      case "rush":
        rushAttempts++;
        rushYards += event.yardage;
        break;
      case "fumble":
        rushAttempts++;
        rushYards += event.yardage;
        fumblesLost++;
        break;
      case "touchdown":
        if (RUN_CONCEPTS.has(event.call.concept)) {
          rushAttempts++;
          rushYards += event.yardage;
        } else {
          passAttempts++;
          completions++;
          passYards += event.yardage;
        }
        break;
    }

    if (event.tags.includes("penalty") || event.penalty) {
      penalties++;
    }
  }

  const turnovers = interceptions + fumblesLost;

  return {
    teamId,
    plays,
    pass_attempts: passAttempts,
    rush_attempts: rushAttempts,
    pass_rate: plays > 0 ? passAttempts / plays : 0,
    rush_rate: plays > 0 ? rushAttempts / plays : 0,
    completion_pct: passAttempts > 0 ? completions / passAttempts : 0,
    yards_per_attempt: passAttempts > 0 ? passYards / passAttempts : 0,
    yards_per_carry: rushAttempts > 0 ? rushYards / rushAttempts : 0,
    pass_yards: passYards,
    rush_yards: rushYards,
    sacks_taken: sacksTaken,
    interceptions,
    fumbles_lost: fumblesLost,
    turnovers,
    penalties,
  };
}

export function deriveTeamGameStats(
  game: GameResult,
  homeTeamId: string,
  awayTeamId: string,
): [TeamGameSample, TeamGameSample] {
  return [
    deriveForTeam(game.events, homeTeamId),
    deriveForTeam(game.events, awayTeamId),
  ];
}
