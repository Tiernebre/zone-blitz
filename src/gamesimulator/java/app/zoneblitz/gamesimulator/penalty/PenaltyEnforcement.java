package app.zoneblitz.gamesimulator.penalty;

/**
 * How a penalty's yardage and down effect are enforced. Orthogonal knobs captured in one record so
 * the catalog stays a flat table and {@link PenaltyEnforcer} reads the enforcement without a
 * per-type switch.
 *
 * <p>Spot semantics:
 *
 * <ul>
 *   <li>{@link Spot#PREVIOUS_SPOT} — measure from the pre-snap line of scrimmage. Used for pre-snap
 *       fouls and most live-ball fouls against the offense (offensive holding, OPI).
 *   <li>{@link Spot#END_OF_PLAY} — measure from wherever the ball ended up (succeeding spot). Used
 *       for live-ball fouls against the defense discovered downfield (defensive holding away from
 *       the ball, personal fouls on the tackler) and for all post-play dead-ball fouls.
 *   <li>{@link Spot#SPOT_OF_FOUL} — spot foul; the enforcer approximates by treating the drawn
 *       yardage as distance from the previous spot. Used for defensive PI.
 * </ul>
 */
public record PenaltyEnforcement(
    Spot spot, boolean replayDown, boolean autoFirstDown, boolean lossOfDown) {

  public enum Spot {
    PREVIOUS_SPOT,
    END_OF_PLAY,
    SPOT_OF_FOUL
  }

  public static PenaltyEnforcement preSnap() {
    return new PenaltyEnforcement(Spot.PREVIOUS_SPOT, true, false, false);
  }

  public static PenaltyEnforcement offenseReplay() {
    return new PenaltyEnforcement(Spot.PREVIOUS_SPOT, true, false, false);
  }

  public static PenaltyEnforcement offenseLossOfDown() {
    return new PenaltyEnforcement(Spot.PREVIOUS_SPOT, false, false, true);
  }

  public static PenaltyEnforcement defenseAutoFirstDown() {
    return new PenaltyEnforcement(Spot.PREVIOUS_SPOT, false, true, false);
  }

  public static PenaltyEnforcement defensiveSpotFoul() {
    return new PenaltyEnforcement(Spot.SPOT_OF_FOUL, false, true, false);
  }

  public static PenaltyEnforcement personalFoulOnDefense() {
    return new PenaltyEnforcement(Spot.END_OF_PLAY, false, true, false);
  }

  public static PenaltyEnforcement personalFoulOnOffense() {
    return new PenaltyEnforcement(Spot.END_OF_PLAY, false, false, false);
  }

  public static PenaltyEnforcement postPlayDeadBall() {
    return new PenaltyEnforcement(Spot.END_OF_PLAY, false, false, false);
  }
}
