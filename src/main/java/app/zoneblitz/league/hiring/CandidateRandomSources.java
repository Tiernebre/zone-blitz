package app.zoneblitz.league;

import app.zoneblitz.gamesimulator.rng.RandomSource;

/**
 * Factory seam producing a deterministic {@link RandomSource} for a {@code (leagueId, phase)} pair.
 * Lets phase-entry handlers generate reproducible candidate pools without depending on a concrete
 * RNG implementation.
 */
interface CandidateRandomSources {

  /** Return a seeded {@link RandomSource} scoped to the given league and phase. */
  RandomSource forLeaguePhase(long leagueId, LeaguePhase phase);
}
