package app.zoneblitz.gamesimulator.event;

/**
 * Rushing play concept used to classify a {@link PlayEvent.Run}.
 *
 * <p>Each constant carries leg weights for the role-keyed run matchup shift: {@link
 * #blockingLegWeight()} scales the run-blocker-vs-defender delta, {@link #carrierLegWeight()}
 * scales the ball-carrier-vs-defender delta. {@code INSIDE_ZONE} uses {@code 1.0 / 1.0} so the
 * legacy {@code blocking + carrier} shape is preserved exactly. POWER/TRAP tilt the blocking leg up
 * (interior maul), OUTSIDE_ZONE/SWEEP shift weight onto the carrier leg (edge speed), DRAW/QB_DRAW
 * are carrier-dominant against a pass-rushing front, QB_SNEAK is interior leverage dominant.
 */
public enum RunConcept implements ConceptFamily {
  INSIDE_ZONE(1.0, 1.0),
  OUTSIDE_ZONE(0.9, 1.2),
  POWER(1.3, 0.8),
  COUNTER(1.1, 1.0),
  DRAW(0.7, 1.3),
  TRAP(1.2, 0.9),
  SWEEP(0.8, 1.3),
  QB_SNEAK(1.5, 0.5),
  QB_DRAW(0.7, 1.3),
  OTHER(1.0, 1.0);

  private final double blockingLegWeight;
  private final double carrierLegWeight;

  RunConcept(double blockingLegWeight, double carrierLegWeight) {
    this.blockingLegWeight = blockingLegWeight;
    this.carrierLegWeight = carrierLegWeight;
  }

  public double blockingLegWeight() {
    return blockingLegWeight;
  }

  public double carrierLegWeight() {
    return carrierLegWeight;
  }
}
