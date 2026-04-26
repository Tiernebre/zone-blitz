package app.zoneblitz.gamesimulator.formation;

import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.rng.RandomSource;

/**
 * Samples the number of defenders the defense aligns in the tackle box given the offense's pre-snap
 * formation, intended play type, and on-field personnel.
 *
 * <p>Implementations draw from formation-conditional distributions calibrated on Big Data Bowl
 * tracking data, then multiplicatively shift the band based on the offense's run-threat profile
 * (heavy OL ⇒ defense loads box; light OL ⇒ defense bails). The sampled value feeds the
 * run-matchup shift: offenses tilt positive when the sampled box is lighter than the formation's
 * expected box, and negative when it's heavier.
 *
 * <p>With league-average attributes the personnel-aware shift collapses to the formation-only
 * distribution — baseline parity is a structural invariant.
 */
public interface BoxCountSampler {

  /**
   * Sample a defender-in-box count in {@code [0, 11]} for the given formation × play-type × on-
   * field offense.
   *
   * @param formation the offensive formation shown pre-snap
   * @param playType the coach-intended play type (run/pass) — defense's expectation shifts the
   *     distribution
   * @param personnel the offense's on-field personnel; OL run-threat shifts the band weights
   * @param rng randomness source
   * @return integer defender count, always non-negative
   */
  int sample(
      OffensiveFormation formation,
      PlayType playType,
      OffensivePersonnel personnel,
      RandomSource rng);

  /**
   * Expected (mean) defender-in-box count for the given formation × play-type × on-field offense.
   * Shifts that reference a "neutral" box call this to compute a delta without a second sampling
   * pass; the returned value matches the matched {@link #sample}'s mean.
   */
  double expectedBox(
      OffensiveFormation formation, PlayType playType, OffensivePersonnel personnel);
}
