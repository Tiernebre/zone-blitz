package app.zoneblitz.league;

import app.zoneblitz.gamesimulator.rng.RandomSource;
import java.util.List;

/**
 * Seam for generating a candidate pool for a given phase. One implementation per candidate kind
 * (e.g. {@code HeadCoachGenerator}, {@code DirectorOfScoutingGenerator}). Generators are pure
 * functions over ({@code poolSize}, {@link RandomSource}) — no DB access, no side effects.
 *
 * <p>Generators must obey the hidden-info contract in {@code docs/technical/league-phases.md}:
 *
 * <ol>
 *   <li>Sample {@code true_rating} from the tier's underlying distribution.
 *   <li>Derive price signals (compensation target, contract length, guaranteed money) from
 *       <em>perceived value only</em> — age, experience, archetype, specialty. True rating must not
 *       enter the price function.
 *   <li>Derive {@code scouted_attrs} by applying tier-specific noise to the hidden attribute set.
 * </ol>
 *
 * Violating step 2 collapses the market dynamic and is a bug.
 */
public interface CandidateGenerator {

  /**
   * Generate {@code poolSize} candidates drawn from the tier this generator represents. The
   * returned list is immutable and ordered; ordering has no semantic meaning. Callers persist the
   * generated candidates via the candidate and preferences repositories; the returned preferences
   * draft is keyed once the candidate id is known.
   *
   * @param poolSize how many candidates to generate (must be {@code > 0}).
   * @param rng randomness source; all stochastic draws flow through it so results are deterministic
   *     given its seed.
   * @return an immutable list of generated candidates (candidate + preferences draft pairs).
   */
  List<GeneratedCandidate> generate(int poolSize, RandomSource rng);
}
