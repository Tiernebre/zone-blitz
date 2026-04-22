package app.zoneblitz.league.hiring;

import app.zoneblitz.gamesimulator.rng.RandomSource;
import java.util.List;

/**
 * Seam for generating subordinate scout candidates (not Director of Scouting). Parameterized by
 * {@link ScoutBranch} — every returned candidate has {@link CandidateKind#SCOUT} and the argument
 * branch. Follows the same hidden-info contract as {@link CandidateGenerator}: true rating sampled
 * independently; price signals from perceived features only.
 */
public interface ScoutCandidatePoolGenerator {

  /**
   * Generate {@code poolSize} subordinate scouts operating in the given {@code branch}.
   *
   * @param poolSize how many candidates to generate (must be {@code > 0}).
   * @param branch the scouting operation (college vs. pro) the scouts cover.
   * @param rng randomness source; all stochastic draws flow through it so results are deterministic
   *     given its seed.
   * @return an immutable list of generated candidates (candidate + preferences draft pairs).
   */
  List<GeneratedCandidate> generate(int poolSize, ScoutBranch branch, RandomSource rng);
}
