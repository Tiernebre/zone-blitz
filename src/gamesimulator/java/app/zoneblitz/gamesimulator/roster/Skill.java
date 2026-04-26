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
 * <p>QB-specific axes: {@link #armStrength} (deep-throw band ceiling, wind/cold mitigation), {@link
 * #shortAccuracy} and {@link #deepAccuracy} (completion% by depth tier), {@link #pocketPresence}
 * (sack-vs-throwaway split under pressure), {@link #playAction} (PA freeze magnitude), {@link
 * #mobility} (scramble yards / sack escape).
 *
 * <p>Ball-handling axes: {@link #carrying} (fumble susceptibility), {@link #catching} (RB
 * out-of-backfield catch rate, distinct from {@link #hands}), {@link #passProtection} (RB stay-in
 * pass-block reps; OL/FB use {@link #passSet}).
 *
 * <p>Receiver micro axes: {@link #release} (vs press at LOS), {@link #contestedCatch} (50-50 ball
 * win rate, distinct from sticky-fingers {@link #hands}).
 *
 * <p>Defensive back micro axes: {@link #pressCoverage} (CB jam technique vs WR {@link #release}),
 * {@link #ballSkills} (INT/PBU rate when in coverage position).
 *
 * <p>Special-teams axes (drive {@code K} / {@code P} / {@code LS} levers): {@link #kickPower} (FG
 * distance ceiling, kickoff hang/distance), {@link #kickAccuracy} (FG/PAT make rate, wind
 * resistance), {@link #puntPower} (gross punt yards), {@link #puntAccuracy} (placement: inside-20
 * vs. touchback/OOB tilt), {@link #puntHangTime} (limits punt return yards), {@link #snapAccuracy}
 * (LS bad-snap rate on punts and FGs).
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
    int puntHangTime,
    int armStrength,
    int shortAccuracy,
    int deepAccuracy,
    int pocketPresence,
    int playAction,
    int mobility,
    int carrying,
    int catching,
    int passProtection,
    int release,
    int contestedCatch,
    int pressCoverage,
    int ballSkills,
    int snapAccuracy) {

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
    requireInRange(armStrength, "armStrength");
    requireInRange(shortAccuracy, "shortAccuracy");
    requireInRange(deepAccuracy, "deepAccuracy");
    requireInRange(pocketPresence, "pocketPresence");
    requireInRange(playAction, "playAction");
    requireInRange(mobility, "mobility");
    requireInRange(carrying, "carrying");
    requireInRange(catching, "catching");
    requireInRange(passProtection, "passProtection");
    requireInRange(release, "release");
    requireInRange(contestedCatch, "contestedCatch");
    requireInRange(pressCoverage, "pressCoverage");
    requireInRange(ballSkills, "ballSkills");
    requireInRange(snapAccuracy, "snapAccuracy");
  }

  /** Average-everywhere profile (all axes at 50). Matchup-neutral default. */
  public static Skill average() {
    return new Skill(
        50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50,
        50, 50, 50, 50, 50, 50);
  }

  private static void requireInRange(int value, String name) {
    if (value < 0 || value > 100) {
      throw new IllegalArgumentException(name + " must be in [0, 100], got " + value);
    }
  }
}
