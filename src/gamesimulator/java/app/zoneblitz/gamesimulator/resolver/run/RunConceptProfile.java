package app.zoneblitz.gamesimulator.resolver.run;

import java.util.Objects;

/**
 * How a single {@link app.zoneblitz.gamesimulator.event.RunConcept} weights the two clamped-delta
 * legs of the run matchup shift and which attributes each side cares about.
 *
 * <p>The two "legs" are: the blocking leg (run blockers vs. run defenders) and the carrier leg
 * (ball carrier vs. run defenders). Both legs share the same defensive player pool — the {@code
 * defFront} weights control which defensive attributes matter for this concept (e.g. edge speed for
 * OUTSIDE_ZONE, interior anchor for POWER).
 *
 * <p>Leg weights scale each clamped delta before summing. Baseline parity is preserved by the
 * {@code INSIDE_ZONE} profile using {@code 1.0 / 1.0} — that reproduces the legacy "blocking +
 * carrier" sum exactly.
 *
 * <p>Package-private — profiles are an internal seam and never leak onto the resolver's API.
 */
record RunConceptProfile(
    double blockingLegWeight,
    double carrierLegWeight,
    RunAttributeWeights offBlockers,
    RunAttributeWeights offCarrier,
    RunAttributeWeights defFront) {

  RunConceptProfile {
    Objects.requireNonNull(offBlockers, "offBlockers");
    Objects.requireNonNull(offCarrier, "offCarrier");
    Objects.requireNonNull(defFront, "defFront");
    if (blockingLegWeight < 0.0 || carrierLegWeight < 0.0) {
      throw new IllegalArgumentException("leg weights must be non-negative");
    }
  }
}
