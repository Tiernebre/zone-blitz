package app.zoneblitz.gamesimulator.roster;

/**
 * Tendency attribute family — behavioral knobs applied contextually, 0–100 per axis.
 *
 * <p>Each tendency maps to a specific sim lever documented in the design doc (lines 234-247):
 * composure decays |m| in high-leverage contexts, discipline shifts per-player penalty rates,
 * football IQ lowers INT rate / gates run fit, processing reduces effective pressure, toughness
 * resists injury, clutch is a late-game composure variant, consistency narrows variance, motor
 * resists fatigue. R4 carries the fields so downstream tasks (PenaltyModel, InjuryModel,
 * FatigueModel, in-context composure decay) can read them without schema churn.
 */
public record Tendencies(
    int composure,
    int discipline,
    int footballIq,
    int processing,
    int toughness,
    int clutch,
    int consistency,
    int motor) {

  public Tendencies {
    requireInRange(composure, "composure");
    requireInRange(discipline, "discipline");
    requireInRange(footballIq, "footballIq");
    requireInRange(processing, "processing");
    requireInRange(toughness, "toughness");
    requireInRange(clutch, "clutch");
    requireInRange(consistency, "consistency");
    requireInRange(motor, "motor");
  }

  /** Average-everywhere profile (all axes at 50). Matchup-neutral default. */
  public static Tendencies average() {
    return new Tendencies(50, 50, 50, 50, 50, 50, 50, 50);
  }

  private static void requireInRange(int value, String name) {
    if (value < 0 || value > 100) {
      throw new IllegalArgumentException(name + " must be in [0, 100], got " + value);
    }
  }
}
