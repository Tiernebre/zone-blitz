package app.zoneblitz.gamesimulator.personnel;

/**
 * NFL defensive personnel groupings. Named by the canonical front — {@code BASE_43}/{@code BASE_34}
 * — or by defensive back count for sub packages ({@code NICKEL} = 5 DBs, {@code DIME} = 6, {@code
 * QUARTER} = 7). The goal-line family spikes extra linemen/linebackers at the expense of DBs for
 * short-yardage looks.
 *
 * <p>Defensive backs are cornerbacks plus safeties; {@link DefensivePersonnel} enforces the
 * per-position totals at construction. "Big nickel" (a NICKEL_425 in which the fifth DB is a safety
 * rather than a corner) is a flavor of this package, not its own constant — capture that with a
 * future sub-variant if needed.
 */
public enum DefensivePackage {
  BASE_43(4, 3, 4),
  BASE_34(3, 4, 4),
  NICKEL_425(4, 2, 5),
  NICKEL_335(3, 3, 5),
  DIME_416(4, 1, 6),
  DIME_326(3, 2, 6),
  QUARTER_317(3, 1, 7),
  GOAL_LINE_641(6, 4, 1),
  GOAL_LINE_551(5, 5, 1),
  GOAL_LINE_632(6, 3, 2),
  GOAL_LINE_740(7, 4, 0);

  private final int defensiveLinemen;
  private final int linebackers;
  private final int defensiveBacks;

  DefensivePackage(int defensiveLinemen, int linebackers, int defensiveBacks) {
    this.defensiveLinemen = defensiveLinemen;
    this.linebackers = linebackers;
    this.defensiveBacks = defensiveBacks;
  }

  public int defensiveLinemen() {
    return defensiveLinemen;
  }

  public int linebackers() {
    return linebackers;
  }

  public int defensiveBacks() {
    return defensiveBacks;
  }
}
