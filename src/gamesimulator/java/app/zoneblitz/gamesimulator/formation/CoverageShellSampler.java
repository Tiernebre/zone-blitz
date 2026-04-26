package app.zoneblitz.gamesimulator.formation;

import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.rng.RandomSource;

/**
 * Samples the defensive coverage shell shown pre-snap given the offense's formation.
 *
 * <p>Implementations draw from formation-conditional priors calibrated on Big Data Bowl 2023's PFF
 * labels. The sampled shell feeds the pass-matchup shift: concept-vs-shell fit (flood vs. Cover-3,
 * mesh vs. man, etc.) tilts the matchup scalar.
 *
 * <p>Only called on dropback plays. Run calls don't need a sampled shell — the defense's run fit is
 * already encoded via the sampled box count.
 *
 * <p>Two overloads exist: a personnel-blind variant that consults only formation bands, and a
 * personnel-aware variant that multiplicatively shifts shell weights based on the offense's
 * receiver-room speed/route-running. With league-average attributes the personnel-aware sampler
 * collapses to the personnel-blind sampler — baseline parity is a structural invariant.
 */
public interface CoverageShellSampler {

  /**
   * Sample a coverage shell for the given offensive formation.
   *
   * @param formation the offensive formation shown pre-snap
   * @param rng randomness source
   * @return sampled shell
   */
  CoverageShell sample(OffensiveFormation formation, RandomSource rng);

  /**
   * Personnel-aware sample. Defaults to the personnel-blind variant; attribute-aware
   * implementations override to multiplicatively shift two-high vs. single-high weights based on
   * the receiver room's vertical-threat profile (speed, route-running).
   */
  default CoverageShell sample(
      OffensiveFormation formation, OffensivePersonnel personnel, RandomSource rng) {
    return sample(formation, rng);
  }
}
