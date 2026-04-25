package app.zoneblitz.gamesimulator.scoring;

import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Coach;
import java.util.Objects;
import java.util.Set;

/**
 * Baseline {@link TwoPointDecisionPolicy}: always kick the PAT except in late-game catch-up
 * situations. The "standard chart" used here is a simplified Vermeil-style rule — in the final five
 * minutes of regulation (or any overtime period) the scoring team goes for two whenever its post-TD
 * deficit is one of the canonical catch-up numbers: 1, 2, 4, 5, or 9 points.
 *
 * <p>The coach's {@link Coach#quality()}{@code .decisionQuality()} gates whether a chart-positive
 * recommendation is actually followed: at 100 the chart is followed deterministically, at 0 the
 * coach kicks every PAT (ignoring the chart entirely), and at intermediate values the chart is
 * honoured with probability {@code decisionQuality / 100}. A chart-negative situation is always
 * honoured — Layer 1 doesn't model false-positive 2-pt attempts. Full lead-protection variants
 * remain out of scope (see issue #574).
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
  public boolean goForTwo(
      Score scoreBeforeTry,
      Side scoringSide,
      GameClock clockAfterTd,
      Coach scoringCoach,
      RandomSource rng) {
    Objects.requireNonNull(scoreBeforeTry, "scoreBeforeTry");
    Objects.requireNonNull(scoringSide, "scoringSide");
    Objects.requireNonNull(clockAfterTd, "clockAfterTd");
    Objects.requireNonNull(scoringCoach, "scoringCoach");
    Objects.requireNonNull(rng, "rng");

    if (!chartSaysGo(scoreBeforeTry, scoringSide, clockAfterTd)) {
      return false;
    }
    var chartAdherence = scoringCoach.quality().decisionQuality() / 100.0;
    return rng.nextDouble() < chartAdherence;
  }

  private static boolean chartSaysGo(
      Score scoreBeforeTry, Side scoringSide, GameClock clockAfterTd) {
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
