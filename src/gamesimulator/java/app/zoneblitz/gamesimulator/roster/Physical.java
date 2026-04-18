package app.zoneblitz.gamesimulator.roster;

/**
 * Physical attribute family — performance capacity, 0–100 per axis.
 *
 * <p>Values 0–20 are the sub-pro cross-role floor (an OL's speed, a CB's throw power). 40+ is the
 * intra-position professional distribution. See {@code player-attributes.md}.
 */
public record Physical(
    int speed,
    int acceleration,
    int agility,
    int strength,
    int power,
    int bend,
    int stamina,
    int explosiveness) {

  public Physical {
    requireInRange(speed, "speed");
    requireInRange(acceleration, "acceleration");
    requireInRange(agility, "agility");
    requireInRange(strength, "strength");
    requireInRange(power, "power");
    requireInRange(bend, "bend");
    requireInRange(stamina, "stamina");
    requireInRange(explosiveness, "explosiveness");
  }

  /**
   * Average-everywhere profile (all axes at 50). Default for roster entries that arrive without
   * attribute data — keeps matchup aggregates at the identity baseline.
   */
  public static Physical average() {
    return new Physical(50, 50, 50, 50, 50, 50, 50, 50);
  }

  private static void requireInRange(int value, String name) {
    if (value < 0 || value > 100) {
      throw new IllegalArgumentException(name + " must be in [0, 100], got " + value);
    }
  }
}
