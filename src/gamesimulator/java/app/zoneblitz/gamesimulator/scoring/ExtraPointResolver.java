package app.zoneblitz.gamesimulator.scoring;

import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Team;

/**
 * Resolves the extra-point kick following a touchdown. Produces a {@link PlayEvent.ExtraPoint} and
 * applies the point (or not) to the scoring side's {@link Score}.
 */
public interface ExtraPointResolver {

  /**
   * @param kickingTeam the team that just scored and is kicking the PAT
   * @param kickingSide which side of the game ledger the kicking team represents
   * @param gameId current game id (for stable event id construction)
   * @param sequence monotonic event sequence number
   * @param clock clock snapshot — PATs don't consume time
   * @param scoreBeforePat score after the TD itself but before the PAT point
   * @param rng randomness source
   */
  Resolved resolve(
      Team kickingTeam,
      Side kickingSide,
      GameId gameId,
      int sequence,
      GameClock clock,
      Score scoreBeforePat,
      RandomSource rng);

  /** The PAT event plus the score after the attempt. */
  record Resolved(PlayEvent.ExtraPoint event, Score scoreAfter) {}
}
