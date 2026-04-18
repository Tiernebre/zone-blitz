package app.zoneblitz.gamesimulator.roster;

/**
 * Skill attribute family — technique attributes per domain, 0–100 per axis.
 *
 * <p>Pass-matchup axes: {@link #passSet} (OL protection), {@link #routeRunning} and {@link #hands}
 * (receivers), {@link #coverageTechnique} (DBs / LBs in coverage), {@link #passRushMoves} and
 * {@link #blockShedding} (rushers). Run-matchup axes: {@link #runBlock} (OL / FB / TE at the point
 * of attack), {@link #ballCarrierVision} and {@link #breakTackle} (the carrier), {@link #tackling}
 * (front-seven and box defenders finishing the play; {@link #blockShedding} doubles as the
 * shed-the-block axis for run defense).
 */
public record Skill(
    int passSet,
    int routeRunning,
    int coverageTechnique,
    int passRushMoves,
    int blockShedding,
    int hands,
    int runBlock,
    int ballCarrierVision,
    int breakTackle,
    int tackling) {

  public Skill {
    requireInRange(passSet, "passSet");
    requireInRange(routeRunning, "routeRunning");
    requireInRange(coverageTechnique, "coverageTechnique");
    requireInRange(passRushMoves, "passRushMoves");
    requireInRange(blockShedding, "blockShedding");
    requireInRange(hands, "hands");
    requireInRange(runBlock, "runBlock");
    requireInRange(ballCarrierVision, "ballCarrierVision");
    requireInRange(breakTackle, "breakTackle");
    requireInRange(tackling, "tackling");
  }

  /** Average-everywhere profile (all axes at 50). Matchup-neutral default. */
  public static Skill average() {
    return new Skill(50, 50, 50, 50, 50, 50, 50, 50, 50, 50);
  }

  private static void requireInRange(int value, String name) {
    if (value < 0 || value > 100) {
      throw new IllegalArgumentException(name + " must be in [0, 100], got " + value);
    }
  }
}
