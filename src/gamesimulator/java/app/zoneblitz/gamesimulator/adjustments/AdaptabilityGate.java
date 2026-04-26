package app.zoneblitz.gamesimulator.adjustments;

/**
 * Maps the {@code inGameAdaptability} 0–100 axis to a scalar applied to the stats-based adjustment
 * bundle. 50 ⇒ 1.0 (full adjustment); 0 ⇒ {@link #STUBBORN_FACTOR}; 100 ⇒ {@link #REACTIVE_FACTOR}.
 *
 * <p>{@link #scaleMultiplier} pulls a multiplier toward 1.0 when the gate factor is below 1.0 (a
 * stubborn coach barely adjusts) and pushes it past the input when the gate factor is above 1.0 (a
 * reactive coach over-corrects).
 */
final class AdaptabilityGate {

  static final double STUBBORN_FACTOR = 0.2;
  static final double NEUTRAL_FACTOR = 1.0;
  static final double REACTIVE_FACTOR = 1.4;

  private AdaptabilityGate() {}

  static double factor(int axis) {
    var clamped = Math.max(0, Math.min(100, axis));
    if (clamped <= 50) {
      var t = clamped / 50.0;
      return STUBBORN_FACTOR + t * (NEUTRAL_FACTOR - STUBBORN_FACTOR);
    }
    var t = (clamped - 50) / 50.0;
    return NEUTRAL_FACTOR + t * (REACTIVE_FACTOR - NEUTRAL_FACTOR);
  }

  /**
   * Scale a centered multiplier {@code m} (where 1.0 is the no-op identity) by {@code gate} —
   * preserves direction (above/below 1.0) and shrinks/expands the deviation.
   */
  static double scaleMultiplier(double m, double gate) {
    return 1.0 + (m - 1.0) * gate;
  }
}
