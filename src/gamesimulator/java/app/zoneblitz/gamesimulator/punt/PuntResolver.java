package app.zoneblitz.gamesimulator.punt;

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
 * Resolves a punt from the current spot. Produces a {@link PlayEvent.Punt} and reports the yard
 * line (in the receiving team's frame, i.e. yards from the receiver's own goal line) where the
 * defending team takes over for the next snap.
 */
public interface PuntResolver {

  /**
   * @param kickingTeam the team punting
   * @param receivingTeam the team receiving — used to pick a returner
   * @param kickingSide side on the game ledger for the kicking team
   * @param gameId game id
   * @param sequence event sequence
   * @param preSnapSpot ball spot from the kicking team's frame (yards from own goal)
   * @param preSnap down/distance at the punt — stamped on the event for audit
   * @param clock clock at the punt; baseline implementations do not tick it
   * @param scoreAfter score to stamp on the emitted event (punts never score)
   * @param rng randomness source
   */
  Resolved resolve(
      Team kickingTeam,
      Team receivingTeam,
      Side kickingSide,
      GameId gameId,
      int sequence,
      FieldPosition preSnapSpot,
      DownAndDistance preSnap,
      GameClock clock,
      Score scoreAfter,
      RandomSource rng);

  /**
   * The punt event plus the yard line the next snap will spot at, expressed in the frame of the
   * team receiving the punt (yards from their own goal).
   */
  record Resolved(PlayEvent.Punt event, int receivingTakeoverYardLine) {}
}
