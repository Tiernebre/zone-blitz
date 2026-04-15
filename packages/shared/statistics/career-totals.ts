import type { PlayerSeasonStatRow } from "../types/player.ts";

export interface CareerTotalsResult {
  gamesPlayed: number;
  gamesStarted: number;
  stats: Record<string, number>;
}

export function computeCareerTotals(
  rows: PlayerSeasonStatRow[],
  statKeys: string[],
): CareerTotalsResult {
  let gamesPlayed = 0;
  let gamesStarted = 0;
  const stats: Record<string, number> = {};

  for (const key of statKeys) {
    stats[key] = 0;
  }

  for (const row of rows) {
    gamesPlayed += row.gamesPlayed;
    gamesStarted += row.gamesStarted;
    for (const key of statKeys) {
      const value = row.stats[key];
      if (typeof value === "number") {
        stats[key] += value;
      }
    }
  }

  return { gamesPlayed, gamesStarted, stats };
}
