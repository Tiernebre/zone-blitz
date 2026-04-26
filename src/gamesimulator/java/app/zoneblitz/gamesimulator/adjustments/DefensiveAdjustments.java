package app.zoneblitz.gamesimulator.adjustments;

import app.zoneblitz.gamesimulator.event.PassConcept;
import java.util.Map;
import java.util.Objects;

/**
 * Bundle of in-game shifts the defense applies on top of its existing baseline-priors-plus-coach
 * lanes. All fields are deltas:
 *
 * <ul>
 *   <li>{@link #blitzLogitShift} — added (in logit space) to the blitz-rate sigmoid.
 *   <li>{@link #manRateLogitShift} — added (in logit space) to the man-rate sigmoid.
 *   <li>{@link #singleHighShellMultiplier} — multiplied into the single-high shell weight before
 *       renormalization. {@code > 1.0} amplifies single-high; {@code < 1.0} biases toward two-high.
 *   <li>{@link #boxLoadingShift} — additive shift consumed by the box-count sampler (Phase 6).
 *       Positive values pull more weight onto 7+ defenders in the box.
 *   <li>{@link #conceptCounterMultipliers} — per-{@link PassConcept} multipliers applied to the
 *       offense's concept-share weights so the defense can implicitly counter what the offense has
 *       been calling repeatedly. Missing keys mean "no adjustment" (treat as 1.0).
 * </ul>
 *
 * <p>{@link #NEUTRAL} is the no-adjustment state every consumer must compose against safely.
 */
public record DefensiveAdjustments(
    double blitzLogitShift,
    double manRateLogitShift,
    double singleHighShellMultiplier,
    double boxLoadingShift,
    Map<PassConcept, Double> conceptCounterMultipliers) {

  public static final DefensiveAdjustments NEUTRAL =
      new DefensiveAdjustments(0.0, 0.0, 1.0, 0.0, Map.of());

  public DefensiveAdjustments {
    Objects.requireNonNull(conceptCounterMultipliers, "conceptCounterMultipliers");
    conceptCounterMultipliers = Map.copyOf(conceptCounterMultipliers);
  }

  public double conceptMultiplier(PassConcept concept) {
    Objects.requireNonNull(concept, "concept");
    return conceptCounterMultipliers.getOrDefault(concept, 1.0);
  }
}
