package app.zoneblitz.gamesimulator.formation;

import app.zoneblitz.gamesimulator.rng.RandomSource;

/**
 * Samples the number of defenders the defense aligns in the tackle box given the offense's pre-snap
 * formation and intended play type.
 *
 * <p>Implementations draw from formation-conditional distributions calibrated on Big Data Bowl
 * tracking data. The sampled value feeds the run-matchup shift: offenses tilt positive when the
 * sampled box is lighter than the formation's expected box, and negative when it's heavier.
 */
public interface BoxCountSampler {

  /**
   * Sample a defender-in-box count in {@code [0, 11]}.
   *
   * @param formation the offensive formation shown pre-snap
   * @param playType the coach-intended play type (run/pass) — defense's expectation shifts the
   *     distribution
   * @param rng randomness source
   * @return integer defender count, always non-negative
   */
  int sample(OffensiveFormation formation, PlayType playType, RandomSource rng);

  /**
   * Expected (mean) defender-in-box count for the given formation × play-type. Shifts that
   * reference a "neutral" box call this to compute a delta without a second sampling pass.
   */
  double expectedBox(OffensiveFormation formation, PlayType playType);
}
