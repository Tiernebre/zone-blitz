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
 *
 * <p>Special-teams axes (drive {@code K} / {@code P} levers): {@link #kickPower} (FG distance
 * ceiling, kickoff hang/distance), {@link #kickAccuracy} (FG/PAT make rate, wind resistance),
 * {@link #puntPower} (gross punt yards), {@link #puntAccuracy} (placement: inside-20 vs.
 * touchback/OOB tilt), {@link #puntHangTime} (limits punt return yards).
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
    int tackling,
    int kickPower,
    int kickAccuracy,
    int puntPower,
    int puntAccuracy,
    int puntHangTime) {

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
    requireInRange(kickPower, "kickPower");
    requireInRange(kickAccuracy, "kickAccuracy");
    requireInRange(puntPower, "puntPower");
    requireInRange(puntAccuracy, "puntAccuracy");
    requireInRange(puntHangTime, "puntHangTime");
  }

  /** Average-everywhere profile (all axes at 50). Matchup-neutral default. */
  public static Skill average() {
    return new Skill(50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50);
  }

  private static void requireInRange(int value, String name) {
    if (value < 0 || value > 100) {
      throw new IllegalArgumentException(name + " must be in [0, 100], got " + value);
    }
  }
}
