package app.zoneblitz.gamesimulator.roster;

/**
 * Defensive coordinator tendency axes — behavioural knobs that perturb league-average defensive
 * calling. Axes are 0–100 deltas against the baseline; 50 reproduces league-average calling. Just
 * like {@link CoachTendencies}, situational priors dominate and tendencies nudge.
 *
 * <p>Axes consumed by {@code DefensiveCallSelector}:
 *
 * <ul>
 *   <li>{@code blitzFrequency} — extra-rusher rate shift above the 4-man baseline.
 *   <li>{@code pressurePackageBias} — simulated-pressure / stunt bias within the 4-rush look.
 *   <li>{@code coverageShellBias} — single-high vs two-high lean.
 *   <li>{@code manZoneBias} — man vs zone coverage mix.
 *   <li>{@code disguiseFrequency} — post-snap rotation / shell flip rate (future hook).
 *   <li>{@code aggressionOnDowns} — situational blitz (3rd-down, red-zone).
 *   <li>{@code runFitDiscipline} — gap integrity vs aggressive flow (future run-fit hook).
 *   <li>{@code substitutionAggression} — nickel/dime usage on early downs.
 * </ul>
 */
public record DefensiveCoachTendencies(
    int blitzFrequency,
    int pressurePackageBias,
    int coverageShellBias,
    int manZoneBias,
    int disguiseFrequency,
    int aggressionOnDowns,
    int runFitDiscipline,
    int substitutionAggression) {

  public DefensiveCoachTendencies {
    requireInRange(blitzFrequency, "blitzFrequency");
    requireInRange(pressurePackageBias, "pressurePackageBias");
    requireInRange(coverageShellBias, "coverageShellBias");
    requireInRange(manZoneBias, "manZoneBias");
    requireInRange(disguiseFrequency, "disguiseFrequency");
    requireInRange(aggressionOnDowns, "aggressionOnDowns");
    requireInRange(runFitDiscipline, "runFitDiscipline");
    requireInRange(substitutionAggression, "substitutionAggression");
  }

  /** League-average coordinator (all axes at 50). */
  public static DefensiveCoachTendencies average() {
    return new DefensiveCoachTendencies(50, 50, 50, 50, 50, 50, 50, 50);
  }

  private static void requireInRange(int value, String name) {
    if (value < 0 || value > 100) {
      throw new IllegalArgumentException(name + " must be in [0, 100], got " + value);
    }
  }
}
