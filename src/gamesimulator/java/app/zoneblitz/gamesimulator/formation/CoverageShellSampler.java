package app.zoneblitz.gamesimulator.formation;

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
 */
@FunctionalInterface
public interface CoverageShellSampler {

  /**
   * Sample a coverage shell for the given offensive formation.
   *
   * @param formation the offensive formation shown pre-snap
   * @param rng randomness source
   * @return sampled shell
   */
  CoverageShell sample(OffensiveFormation formation, RandomSource rng);
}
