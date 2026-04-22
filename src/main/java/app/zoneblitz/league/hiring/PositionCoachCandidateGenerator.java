package app.zoneblitz.league.hiring;

import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.league.staff.SpecialtyPosition;
import java.util.List;

/**
 * Seam for generating position-coach candidates. Parameterized by {@link SpecialtyPosition} — every
 * returned candidate has {@link CandidateKind#POSITION_COACH} and a specialty matching the
 * argument. Follows the same hidden-info contract as {@link CandidateGenerator}: true rating
 * sampled independently; price signals from perceived features only.
 */
public interface PositionCoachCandidateGenerator {

  /**
   * Generate {@code poolSize} position coach candidates specialized in {@code specialty}.
   *
   * @param poolSize how many candidates to generate (must be {@code > 0}).
   * @param specialty the coached position; all returned candidates will have this specialty.
   * @param rng randomness source; all stochastic draws flow through it so results are deterministic
   *     given its seed.
   * @return an immutable list of generated candidates (candidate + preferences draft pairs).
   */
  List<GeneratedCandidate> generate(int poolSize, SpecialtyPosition specialty, RandomSource rng);
}
