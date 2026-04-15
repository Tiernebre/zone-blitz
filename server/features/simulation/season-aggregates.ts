import type { GameResult } from "./events.ts";

export interface SeasonAggregates {
  playsPerGame: number;
  passPercentage: number;
  rushPercentage: number;
  completionPercentage: number;
  yardsPerAttempt: number;
  yardsPerCarry: number;
  sacksPerTeamPerGame: number;
  turnoversPerTeamPerGame: number;
  totalGames: number;
}

export function computeSeasonAggregates(
  results: GameResult[],
): SeasonAggregates {
  if (results.length === 0) {
    return {
      playsPerGame: 0,
      passPercentage: 0,
      rushPercentage: 0,
      completionPercentage: 0,
      yardsPerAttempt: 0,
      yardsPerCarry: 0,
      sacksPerTeamPerGame: 0,
      turnoversPerTeamPerGame: 0,
      totalGames: 0,
    };
  }

  let totalPlays = 0;
  let rushPlays = 0;
  let passAttempts = 0;
  let completions = 0;
  let passYards = 0;
  let rushYards = 0;
  let sacks = 0;
  let turnovers = 0;

  for (const result of results) {
    for (const event of result.events) {
      switch (event.outcome) {
        case "rush":
          totalPlays++;
          rushPlays++;
          rushYards += event.yardage;
          break;
        case "pass_complete":
          totalPlays++;
          passAttempts++;
          completions++;
          passYards += event.yardage;
          break;
        case "pass_incomplete":
          totalPlays++;
          passAttempts++;
          break;
        case "sack":
          totalPlays++;
          passAttempts++;
          sacks++;
          break;
        case "interception":
          totalPlays++;
          passAttempts++;
          break;
        case "fumble":
          totalPlays++;
          rushPlays++;
          rushYards += event.yardage;
          break;
        case "touchdown": {
          totalPlays++;
          const runConcepts = new Set([
            "inside_zone",
            "outside_zone",
            "power",
            "counter",
            "draw",
            "rpo",
          ]);
          if (runConcepts.has(event.call.concept)) {
            rushPlays++;
            rushYards += event.yardage;
          } else {
            passAttempts++;
            completions++;
            passYards += event.yardage;
          }
          break;
        }
      }

      if (event.tags.includes("turnover")) {
        turnovers++;
      }
    }
  }

  const totalCategorized = rushPlays + passAttempts;
  const games = results.length;

  return {
    playsPerGame: totalPlays / games,
    passPercentage: totalCategorized > 0
      ? (passAttempts / totalCategorized) * 100
      : 0,
    rushPercentage: totalCategorized > 0
      ? (rushPlays / totalCategorized) * 100
      : 0,
    completionPercentage: passAttempts > 0
      ? (completions / passAttempts) * 100
      : 0,
    yardsPerAttempt: passAttempts > 0 ? passYards / passAttempts : 0,
    yardsPerCarry: rushPlays > 0 ? rushYards / rushPlays : 0,
    sacksPerTeamPerGame: sacks / (games * 2),
    turnoversPerTeamPerGame: turnovers / (games * 2),
    totalGames: games,
  };
}
