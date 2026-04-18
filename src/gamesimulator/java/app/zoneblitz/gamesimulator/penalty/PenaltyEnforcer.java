package app.zoneblitz.gamesimulator.penalty;

import app.zoneblitz.gamesimulator.event.DownAndDistance;
import app.zoneblitz.gamesimulator.event.FieldPosition;
import app.zoneblitz.gamesimulator.event.Side;

/**
 * Pure utility that resolves a {@link PenaltyDraw} into its post-enforcement spot, down, and
 * distance. The input {@code basisYardLine} is whatever spot the enforcement measures from — the
 * pre-snap line of scrimmage for {@link PenaltyEnforcement.Spot#PREVIOUS_SPOT}, the end-of-play
 * yard line for {@link PenaltyEnforcement.Spot#END_OF_PLAY}, and an approximate spot for {@link
 * PenaltyEnforcement.Spot#SPOT_OF_FOUL} (v1 treats spot-fouls as previous-spot + sampled yards).
 *
 * <p>Expressed in the offense's frame: yard line 0 = offense's own goal, 100 = opposing goal.
 */
public final class PenaltyEnforcer {

  private PenaltyEnforcer() {}

  /**
   * Apply a penalty to the supplied basis spot and down-and-distance.
   *
   * @param preSnap pre-snap down/distance (needed to know yards-to-go for the replayed down)
   * @param preSnapYardLine pre-snap LOS in offense frame (needed for previous-spot enforcement and
   *     to re-compute yards-to-go when the ball moves against offense)
   * @param basisYardLine yard line from which enforcement is measured — see class Javadoc
   * @param offenseSide the offense side on the play; used to determine whether a foul is against
   *     offense or defense
   * @param draw the drawn penalty
   * @return the post-enforcement ball spot and next down/distance
   */
  public static Applied apply(
      DownAndDistance preSnap,
      int preSnapYardLine,
      int basisYardLine,
      Side offenseSide,
      PenaltyDraw draw) {
    var enforcement = draw.enforcement();
    var againstOffense = draw.against() == offenseSide;

    var measureFrom =
        switch (enforcement.spot()) {
          case PREVIOUS_SPOT, SPOT_OF_FOUL -> preSnapYardLine;
          case END_OF_PLAY -> basisYardLine;
        };

    var rawYards = draw.yards();
    var applied = halfDistance(rawYards, measureFrom, againstOffense);
    var newYardLine = againstOffense ? measureFrom - applied : measureFrom + applied;
    newYardLine = Math.max(1, Math.min(99, newYardLine));

    var newSpot = new FieldPosition(newYardLine);
    if (enforcement.autoFirstDown()) {
      return new Applied.Next(newSpot, freshFirstDown(newYardLine), applied);
    }
    if (enforcement.replayDown()) {
      if (!againstOffense && (newYardLine - preSnapYardLine) >= preSnap.yardsToGo()) {
        return new Applied.Next(newSpot, freshFirstDown(newYardLine), applied);
      }
      var toGo =
          againstOffense
              ? preSnap.yardsToGo() + applied
              : Math.max(1, preSnap.yardsToGo() - applied);
      return new Applied.Next(newSpot, new DownAndDistance(preSnap.down(), toGo), applied);
    }
    if (enforcement.lossOfDown()) {
      var nextDown = preSnap.down() + 1;
      if (nextDown > 4) {
        return new Applied.TurnoverOnDowns(newSpot, applied);
      }
      var toGo = Math.max(1, preSnap.yardsToGo() + applied);
      return new Applied.Next(newSpot, new DownAndDistance(nextDown, toGo), applied);
    }
    var gained = newYardLine - preSnapYardLine;
    if (gained >= preSnap.yardsToGo()) {
      return new Applied.Next(newSpot, freshFirstDown(newYardLine), applied);
    }
    var nextDown = preSnap.down() + 1;
    if (nextDown > 4) {
      return new Applied.TurnoverOnDowns(newSpot, applied);
    }
    return new Applied.Next(
        newSpot, new DownAndDistance(nextDown, Math.max(1, preSnap.yardsToGo() - gained)), applied);
  }

  /** Enforcement outcome. Sealed so callers exhaustively handle the turnover-on-downs case. */
  public sealed interface Applied {
    FieldPosition newSpot();

    int yardsApplied();

    record Next(FieldPosition newSpot, DownAndDistance nextDownAndDistance, int yardsApplied)
        implements Applied {}

    record TurnoverOnDowns(FieldPosition newSpot, int yardsApplied) implements Applied {}
  }

  private static int halfDistance(int rawYards, int fromYardLine, boolean againstOffense) {
    // Half-distance-to-the-goal rule: a foul can never place the ball past the offending team's
    // goal line. Against offense moves ball toward offense's own goal (0); against defense moves
    // it toward opposing goal (100).
    if (againstOffense) {
      var max = Math.max(0, fromYardLine - 1);
      return Math.min(rawYards, Math.max(1, max / 2 + (max % 2)));
    }
    var distanceToOppGoal = 100 - fromYardLine;
    return Math.min(rawYards, Math.max(1, distanceToOppGoal / 2 + (distanceToOppGoal % 2)));
  }

  private static DownAndDistance freshFirstDown(int yardLine) {
    var toGo = yardLine >= 90 ? 100 - yardLine : 10;
    return new DownAndDistance(1, toGo);
  }
}
