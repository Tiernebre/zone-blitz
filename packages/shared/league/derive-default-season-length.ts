const MIN_SEASON_LENGTH = 10;
const ANCHOR_TEAMS = 8;
const ANCHOR_LENGTH = 10;
const GAMES_PER_TEAM = 7 / 24;

/**
 * Maps franchise count to a default regular-season length.
 *
 * Anchored at 8 teams → 10 games and 32 teams → 17 games, with linear
 * interpolation/extrapolation. Floors at 10 games for very small leagues.
 */
export function deriveDefaultSeasonLength(franchiseCount: number): number {
  if (franchiseCount <= 0) {
    throw new Error("Franchise count must be positive");
  }

  const raw = ANCHOR_LENGTH + (franchiseCount - ANCHOR_TEAMS) * GAMES_PER_TEAM;
  return Math.max(MIN_SEASON_LENGTH, Math.round(raw));
}
