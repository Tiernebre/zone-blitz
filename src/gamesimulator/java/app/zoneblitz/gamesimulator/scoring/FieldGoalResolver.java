package app.zoneblitz.gamesimulator.scoring;

import app.zoneblitz.gamesimulator.event.DownAndDistance;
import app.zoneblitz.gamesimulator.event.FieldPosition;
import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Team;

/**
 * Resolves a field-goal attempt from the current spot. Produces a {@link
 * PlayEvent.FieldGoalAttempt} and reports the post-kick score plus, on a miss, the takeover spot
 * for the defending team.
 */
public interface FieldGoalResolver {

  /**
   * @param kickingTeam the attempting team
   * @param kickingSide side on the game ledger
   * @param gameId game id
   * @param sequence event sequence
   * @param preSnapSpot ball spot from the kicking team's frame (yards from own goal)
   * @param preSnap the down/distance at the attempt — stamped on the event for audit
   * @param clock clock at the attempt; baseline implementations do not tick it
   * @param scoreBeforeKick score heading into the attempt
   * @param rng randomness source
   */
  Resolved resolve(
      Team kickingTeam,
      Side kickingSide,
      GameId gameId,
      int sequence,
      FieldPosition preSnapSpot,
      DownAndDistance preSnap,
      GameClock clock,
      Score scoreBeforeKick,
      RandomSource rng);

  /**
   * Outcome of a field-goal attempt.
   *
   * <p>{@code receivingTakeoverYardLine} is expressed in the frame of the team receiving the ball
   * after the kick (the defending team on a miss, irrelevant on a made kick since a kickoff
   * follows). Holds {@link java.util.OptionalInt#empty} on a make.
   */
  record Resolved(
      PlayEvent.FieldGoalAttempt event,
      Score scoreAfter,
      boolean made,
      java.util.OptionalInt receivingTakeoverYardLine) {}
}
