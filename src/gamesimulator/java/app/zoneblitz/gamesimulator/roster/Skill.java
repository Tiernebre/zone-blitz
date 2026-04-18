package app.zoneblitz.gamesimulator.roster;

/**
 * Skill attribute family — technique attributes per domain, 0–100 per axis.
 *
 * <p>Scope is the pass-matchup surface the resolvers consume today: {@link #passSet} (OL
 * protection), {@link #routeRunning} and {@link #hands} (receivers), {@link #coverageTechnique}
 * (DBs / LBs in coverage), {@link #passRushMoves} and {@link #blockShedding} (rushers). Run-block,
 * tackling, pocket-presence, and related axes will land alongside their respective resolvers.
 */
public record Skill(
    int passSet,
    int routeRunning,
    int coverageTechnique,
    int passRushMoves,
    int blockShedding,
    int hands) {

  public Skill {
    requireInRange(passSet, "passSet");
    requireInRange(routeRunning, "routeRunning");
    requireInRange(coverageTechnique, "coverageTechnique");
    requireInRange(passRushMoves, "passRushMoves");
    requireInRange(blockShedding, "blockShedding");
    requireInRange(hands, "hands");
  }

  /** Average-everywhere profile (all axes at 50). Matchup-neutral default. */
  public static Skill average() {
    return new Skill(50, 50, 50, 50, 50, 50);
  }

  private static void requireInRange(int value, String name) {
    if (value < 0 || value > 100) {
      throw new IllegalArgumentException(name + " must be in [0, 100], got " + value);
    }
  }
}
