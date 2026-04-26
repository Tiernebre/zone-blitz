package app.zoneblitz.gamesimulator.formation;

import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.rng.RandomSource;

/**
 * Samples the number of defenders the defense aligns in the tackle box given the offense's pre-snap
 * formation and intended play type.
 *
 * <p>Implementations draw from formation-conditional distributions calibrated on Big Data Bowl
 * tracking data. The sampled value feeds the run-matchup shift: offenses tilt positive when the
 * sampled box is lighter than the formation's expected box, and negative when it's heavier.
 *
 * <p>Two overloads exist: a personnel-blind variant that consults only formation × play-type bands,
 * and a personnel-aware variant that multiplicatively shifts the band based on the offense's
 * on-field run-threat profile (heavy OL ⇒ defense loads box; light OL ⇒ defense bails). The
 * personnel-aware variant collapses to the personnel-blind variant when the on-field roster is
 * league-average across the relevant axes — baseline parity is a structural invariant.
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

  /**
   * Personnel-aware sample. Defaults to the personnel-blind variant; attribute-aware
   * implementations override to multiplicatively shift the band based on {@code personnel}'s
   * run-threat attributes (OL strength/power/run-block). With league-average attributes the result
   * is statistically indistinguishable from the personnel-blind sample.
   */
  default int sample(
      OffensiveFormation formation,
      PlayType playType,
      OffensivePersonnel personnel,
      RandomSource rng) {
    return sample(formation, playType, rng);
  }

  /**
   * Personnel-aware expected box. Defaults to the personnel-blind variant. Attribute-aware
   * implementations should return a value that matches the matched sample mean.
   */
  default double expectedBox(
      OffensiveFormation formation, PlayType playType, OffensivePersonnel personnel) {
    return expectedBox(formation, playType);
  }
}
