package app.zoneblitz.gamesimulator.roster;

/**
 * Coach execution-quality axes — how close a coach lands to the "right" call, orthogonal to the
 * stylistic tendencies in {@link CoachTendencies} and {@link DefensiveCoachTendencies}. Axes are
 * 0–100 and centre at 50; a 50 on every axis reproduces league-average behaviour.
 *
 * <p>Tendencies answer "what does this coach like to do?". Quality answers "how often do they land
 * on the right answer anyway?". The two are independent — a pass-happy coach can still make
 * high-quality decisions, and a 4th-down-aggressive coach can still be undisciplined pre-snap.
 *
 * <ul>
 *   <li>{@code decisionQuality} — blends tendency-driven choices toward an EV-optimal reference at
 *       decision surfaces with a clean EV signal (4th-down go/kick, two-point chart, timeout
 *       timing). 0 = follow raw tendency; 100 = fully chart-optimal.
 *   <li>{@code preparation} — scales pre-snap mental-error rates (false start, delay of game,
 *       illegal formation/motion, 12 on field). 100 = flawless; 0 = double the league rate.
 * </ul>
 */
public record CoachQuality(int decisionQuality, int preparation) {

  public CoachQuality {
    requireInRange(decisionQuality, "decisionQuality");
    requireInRange(preparation, "preparation");
  }

  /** League-average coach quality (all axes at 50). */
  public static CoachQuality average() {
    return new CoachQuality(50, 50);
  }

  private static void requireInRange(int value, String name) {
    if (value < 0 || value > 100) {
      throw new IllegalArgumentException(name + " must be in [0, 100], got " + value);
    }
  }
}
