package app.zoneblitz.gamesimulator.resolver.pass;

import java.util.Objects;

/**
 * How a single {@link app.zoneblitz.gamesimulator.event.PassConcept} weights the two clamped-delta
 * legs of the pass matchup shift and which attributes each side cares about.
 *
 * <p>The two "legs" are: the coverage leg (route runners vs. coverage defenders) and the pass-rush
 * leg (pass rushers vs. pass blockers). Per-concept leg weights reflect real outcome data: screens
 * and quick-game drop pass-rush weight to near zero (0.1% and 0% sack rates vs. 14% for dropback),
 * hail mary leans entirely on coverage physical mismatch, play-action tilts the coverage leg up for
 * the deeper-shot profile.
 *
 * <p>Leg weights scale each clamped delta before summing. Baseline parity is preserved by the
 * {@code DROPBACK} profile using {@code 1.0 / 1.0} — that reproduces the legacy "coverage −
 * pass_rush" formula exactly.
 *
 * <p>Package-private — profiles are an internal seam and never leak onto the resolver's API.
 */
record PassConceptProfile(
    double coverageLegWeight,
    double passRushLegWeight,
    PassAttributeWeights offRoute,
    PassAttributeWeights offProtection,
    PassAttributeWeights defCoverage,
    PassAttributeWeights defPassRush) {

  PassConceptProfile {
    Objects.requireNonNull(offRoute, "offRoute");
    Objects.requireNonNull(offProtection, "offProtection");
    Objects.requireNonNull(defCoverage, "defCoverage");
    Objects.requireNonNull(defPassRush, "defPassRush");
    if (coverageLegWeight < 0.0 || passRushLegWeight < 0.0) {
      throw new IllegalArgumentException("leg weights must be non-negative");
    }
  }
}
