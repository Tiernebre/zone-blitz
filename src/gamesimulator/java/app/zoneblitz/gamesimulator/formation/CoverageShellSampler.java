package app.zoneblitz.gamesimulator.formation;

import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.rng.RandomSource;

/**
 * Samples the defensive coverage shell shown pre-snap given the offense's formation and on-field
 * personnel.
 *
 * <p>Implementations draw from formation-conditional priors calibrated on Big Data Bowl 2023's PFF
 * labels, then multiplicatively shift two-high vs. single-high weights based on the receiver room's
 * vertical-threat profile (speed, route-running). The sampled shell feeds the pass-matchup shift:
 * concept-vs-shell fit (flood vs. Cover-3, mesh vs. man, etc.) tilts the matchup scalar.
 *
 * <p>Only called on dropback plays. Run calls don't need a sampled shell — the defense's run fit is
 * already encoded via the sampled box count.
 *
 * <p>With league-average receiver attributes the personnel-aware shift collapses to the
 * formation-only distribution — baseline parity is a structural invariant.
 */
public interface CoverageShellSampler {

  /**
   * Sample a coverage shell for the given offensive formation × on-field offense.
   *
   * @param formation the offensive formation shown pre-snap
   * @param personnel the offense's on-field personnel; receiver speed/route-running shifts shell
   *     weights
   * @param rng randomness source
   * @return sampled shell
   */
  CoverageShell sample(
      OffensiveFormation formation, OffensivePersonnel personnel, RandomSource rng);
}
