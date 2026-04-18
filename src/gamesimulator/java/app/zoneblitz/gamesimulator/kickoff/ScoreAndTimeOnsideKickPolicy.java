package app.zoneblitz.gamesimulator.kickoff;

import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.Side;

/**
 * Default onside-kick decision policy driven only by score differential and time remaining.
 *
 * <p>A coach attempts an onside kick when <em>all</em> of the following hold:
 *
 * <ul>
 *   <li>the kicking team is trailing (has just scored and is still behind),
 *   <li>the deficit is at most {@link #MAX_DEFICIT} (a two-possession game; larger deficits imply a
 *       collapse where even a successful onside likely isn't enough),
 *   <li>the game is in the closing window: Q4 with at most {@link #Q4_SECONDS_THRESHOLD} seconds
 *       remaining, or any time in overtime.
 * </ul>
 *
 * The thresholds mirror what real NFL staffs do: onside attempts outside the final ~5 minutes of
 * Q4, or when tied/leading, are exceedingly rare and we don't try to model them here. A richer
 * coach-tendency hook can be swapped in later by providing a different {@link OnsideKickPolicy}
 * implementation.
 */
final class ScoreAndTimeOnsideKickPolicy implements OnsideKickPolicy {

  static final int Q4_SECONDS_THRESHOLD = 5 * 60;
  static final int MAX_DEFICIT = 16;

  @Override
  public boolean shouldAttemptOnside(Side receivingSide, Score score, GameClock clock) {
    var kickingSide = receivingSide == Side.HOME ? Side.AWAY : Side.HOME;
    var kickingScore = kickingSide == Side.HOME ? score.home() : score.away();
    var receivingScore = kickingSide == Side.HOME ? score.away() : score.home();
    var deficit = receivingScore - kickingScore;
    if (deficit <= 0 || deficit > MAX_DEFICIT) {
      return false;
    }
    var quarter = clock.quarter();
    if (quarter >= 5) {
      return true;
    }
    return quarter == 4 && clock.secondsRemaining() <= Q4_SECONDS_THRESHOLD;
  }
}
