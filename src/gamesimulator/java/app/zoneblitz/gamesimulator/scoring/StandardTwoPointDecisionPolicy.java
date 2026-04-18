package app.zoneblitz.gamesimulator.scoring;

import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.Side;
import java.util.Objects;
import java.util.Set;

/**
 * Baseline {@link TwoPointDecisionPolicy}: always kick the PAT except in late-game catch-up
 * situations. The "standard chart" used here is a simplified Vermeil-style rule — in the final five
 * minutes of regulation (or any overtime period) the scoring team goes for two whenever its post-TD
 * deficit is one of the canonical catch-up numbers: 1, 2, 4, 5, or 9 points. Every other situation
 * kicks the extra point. Full coach aggressiveness / lead-protection variants are out of scope for
 * v1 (see issue #574).
 */
public final class StandardTwoPointDecisionPolicy implements TwoPointDecisionPolicy {

  /**
   * Post-TD deficits (scoring team still trailing by this many) that warrant going for two in the
   * late-game window. Hitting a 2 after one of these puts the team in a tying or one-score range
   * that couldn't be reached with a PAT.
   */
  private static final Set<Integer> CATCH_UP_DEFICITS = Set.of(1, 2, 4, 5, 9);

  /** Last five minutes of a regulation quarter (or any overtime period) count as "late game". */
  private static final int LATE_GAME_SECONDS = 5 * 60;

  @Override
  public boolean goForTwo(Score scoreBeforeTry, Side scoringSide, GameClock clockAfterTd) {
    Objects.requireNonNull(scoreBeforeTry, "scoreBeforeTry");
    Objects.requireNonNull(scoringSide, "scoringSide");
    Objects.requireNonNull(clockAfterTd, "clockAfterTd");

    if (!isLateGame(clockAfterTd)) {
      return false;
    }

    var scoring = pointsFor(scoreBeforeTry, scoringSide);
    var opponent = pointsFor(scoreBeforeTry, scoringSide == Side.HOME ? Side.AWAY : Side.HOME);
    var deficit = opponent - scoring;
    return deficit > 0 && CATCH_UP_DEFICITS.contains(deficit);
  }

  private static boolean isLateGame(GameClock clock) {
    var inFourthOrLater = clock.quarter() >= 4;
    return inFourthOrLater && clock.secondsRemaining() <= LATE_GAME_SECONDS;
  }

  private static int pointsFor(Score score, Side side) {
    return switch (side) {
      case HOME -> score.home();
      case AWAY -> score.away();
    };
  }
}
