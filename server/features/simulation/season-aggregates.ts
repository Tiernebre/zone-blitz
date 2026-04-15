import type { GameResult, PlayEvent } from "./events.ts";

export interface GameAggregates {
  totalPlays: number;
  rushPlays: number;
  passAttempts: number;
  completions: number;
  passYards: number;
  rushYards: number;
  sacks: number;
  turnovers: number;
  games: number;
}

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

function isOffensivePlay(event: PlayEvent): boolean {
  return (
    event.outcome === "rush" ||
    event.outcome === "pass_complete" ||
    event.outcome === "pass_incomplete" ||
    event.outcome === "sack" ||
    event.outcome === "interception" ||
    event.outcome === "fumble" ||
    event.outcome === "touchdown"
  );
}

function isPassAttempt(event: PlayEvent): boolean {
  return (
    event.outcome === "pass_complete" ||
    event.outcome === "pass_incomplete" ||
    event.outcome === "interception" ||
    event.outcome === "sack"
  );
}

function isCompletion(event: PlayEvent): boolean {
  return event.outcome === "pass_complete";
}

function isRush(event: PlayEvent): boolean {
  return event.outcome === "rush" || event.outcome === "fumble";
}

function isSack(event: PlayEvent): boolean {
  return event.outcome === "sack";
}

function isTurnover(event: PlayEvent): boolean {
  return event.tags.includes("turnover");
}

export function computeGameAggregates(results: GameResult[]): GameAggregates {
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
      if (!isOffensivePlay(event)) continue;

      totalPlays++;

      if (isPassAttempt(event)) {
        passAttempts++;
        if (isCompletion(event)) {
          completions++;
          passYards += event.yardage;
        }
        if (isSack(event)) {
          sacks++;
        }
      } else if (isRush(event)) {
        rushPlays++;
        rushYards += event.yardage;
      }

      if (event.outcome === "touchdown") {
        const call = event.call;
        const runConcepts = new Set([
          "inside_zone",
          "outside_zone",
          "power",
          "counter",
          "draw",
          "rpo",
        ]);
        if (runConcepts.has(call.concept)) {
          rushPlays++;
          rushYards += event.yardage;
        } else {
          passAttempts++;
          completions++;
          passYards += event.yardage;
        }
      }

      if (isTurnover(event)) {
        turnovers++;
      }
    }
  }

  return {
    totalPlays,
    rushPlays,
    passAttempts,
    completions,
    passYards,
    rushYards,
    sacks,
    turnovers,
    games: results.length,
  };
}

export function computeSeasonAggregates(
  results: GameResult[],
): SeasonAggregates {
  const agg = computeGameAggregates(results);
  const totalOffensive = agg.rushPlays + agg.passAttempts;

  return {
    playsPerGame: agg.games > 0 ? agg.totalPlays / agg.games : 0,
    passPercentage: totalOffensive > 0
      ? (agg.passAttempts / totalOffensive) * 100
      : 0,
    rushPercentage: totalOffensive > 0
      ? (agg.rushPlays / totalOffensive) * 100
      : 0,
    completionPercentage: agg.passAttempts > 0
      ? (agg.completions / agg.passAttempts) * 100
      : 0,
    yardsPerAttempt: agg.passAttempts > 0
      ? agg.passYards / agg.passAttempts
      : 0,
    yardsPerCarry: agg.rushPlays > 0 ? agg.rushYards / agg.rushPlays : 0,
    sacksPerTeamPerGame: agg.games > 0 ? agg.sacks / (agg.games * 2) : 0,
    turnoversPerTeamPerGame: agg.games > 0
      ? agg.turnovers / (agg.games * 2)
      : 0,
    totalGames: agg.games,
  };
}
