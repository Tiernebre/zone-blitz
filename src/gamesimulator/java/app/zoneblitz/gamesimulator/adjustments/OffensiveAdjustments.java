package app.zoneblitz.gamesimulator.adjustments;

import app.zoneblitz.gamesimulator.event.PassConcept;
import app.zoneblitz.gamesimulator.event.RunConcept;
import java.util.Map;
import java.util.Objects;

/**
 * Bundle of in-game shifts the offense applies on top of its baseline-priors-plus-coach lanes.
 *
 * <ul>
 *   <li>{@link #passRateLogitShift} — added (in logit space) to the blended pass-rate sigmoid.
 *   <li>{@link #passConceptMultipliers} — per-{@link PassConcept} multipliers applied to the
 *       coach-adjusted concept weights before renormalization.
 *   <li>{@link #runConceptMultipliers} — per-{@link RunConcept} multipliers applied to the
 *       coach-adjusted run-concept weights before renormalization.
 *   <li>{@link #shotgunLogitShift} — additive shift on the shotgun-vs-under-center lean before
 *       formation weight renormalization.
 * </ul>
 *
 * <p>Missing concept-multiplier keys mean "no adjustment" (treat as 1.0).
 */
public record OffensiveAdjustments(
    double passRateLogitShift,
    Map<PassConcept, Double> passConceptMultipliers,
    Map<RunConcept, Double> runConceptMultipliers,
    double shotgunLogitShift) {

  public static final OffensiveAdjustments NEUTRAL =
      new OffensiveAdjustments(0.0, Map.of(), Map.of(), 0.0);

  public OffensiveAdjustments {
    Objects.requireNonNull(passConceptMultipliers, "passConceptMultipliers");
    Objects.requireNonNull(runConceptMultipliers, "runConceptMultipliers");
    passConceptMultipliers = Map.copyOf(passConceptMultipliers);
    runConceptMultipliers = Map.copyOf(runConceptMultipliers);
  }

  public double passConceptMultiplier(PassConcept concept) {
    Objects.requireNonNull(concept, "concept");
    return passConceptMultipliers.getOrDefault(concept, 1.0);
  }

  public double runConceptMultiplier(RunConcept concept) {
    Objects.requireNonNull(concept, "concept");
    return runConceptMultipliers.getOrDefault(concept, 1.0);
  }
}
