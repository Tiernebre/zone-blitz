package app.zoneblitz.gamesimulator.kickoff;

import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.Side;

/**
 * Decides whether the kicking team will attempt an onside kick on a given kickoff.
 *
 * <p>This is the "should we go for it" seam; the probability that a declared onside attempt is
 * actually recovered by the kicking team is owned by {@link KickoffResolver} implementations.
 */
interface OnsideKickPolicy {

  /**
   * @param receivingSide which side is receiving the kick; the kicking side is the opposite
   * @param score score at the moment of the kickoff (after the just-scored points)
   * @param clock clock at the moment of the kickoff
   * @return {@code true} if the kicking team should declare an onside attempt
   */
  boolean shouldAttemptOnside(Side receivingSide, Score score, GameClock clock);
}
