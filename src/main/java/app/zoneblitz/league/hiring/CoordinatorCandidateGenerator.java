package app.zoneblitz.league.hiring;

import app.zoneblitz.gamesimulator.rng.RandomSource;
import java.util.List;

/**
 * Seam for generating coordinator candidates (OC, DC, ST). Parameterized by {@link CandidateKind}
 * because a single generator produces all three coordinator kinds — the kind bias (archetype,
 * specialty) is keyed off the argument. Follows the same hidden-info contract as {@link
 * CandidateGenerator}: true rating sampled independently; price signals from perceived features
 * only.
 */
public interface CoordinatorCandidateGenerator {

  /**
   * Generate {@code poolSize} coordinator candidates of the given {@code kind}. {@code kind} must
   * be one of {@link CandidateKind#OFFENSIVE_COORDINATOR}, {@link
   * CandidateKind#DEFENSIVE_COORDINATOR}, or {@link CandidateKind#SPECIAL_TEAMS_COORDINATOR}.
   *
   * @param poolSize how many candidates to generate (must be {@code > 0}).
   * @param kind which coordinator kind to generate.
   * @param rng randomness source; all stochastic draws flow through it so results are deterministic
   *     given its seed.
   * @return an immutable list of generated candidates (candidate + preferences draft pairs).
   */
  List<GeneratedCandidate> generate(int poolSize, CandidateKind kind, RandomSource rng);
}
