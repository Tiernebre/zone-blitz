package app.zoneblitz.league.hiring;

import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import app.zoneblitz.league.phase.LeaguePhase;
import org.springframework.stereotype.Component;

/**
 * Production {@link CandidateRandomSources}. Derives a deterministic seed from {@code leagueId}
 * mixed with the phase ordinal so the same league re-entering the same phase produces the same pool
 * — useful for reproducibility and tests.
 */
@Component
public class SplittableCandidateRandomSources implements CandidateRandomSources {

  @Override
  public RandomSource forLeaguePhase(long leagueId, LeaguePhase phase) {
    var seed = leagueId * 0x9E3779B97F4A7C15L ^ (long) phase.ordinal();
    return new SplittableRandomSource(seed);
  }
}
