package app.zoneblitz.gamesimulator.scoring;

import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Team;

/**
 * Resolves a two-point conversion attempt from the opponent's two-yard line. Produces a {@link
 * PlayEvent.TwoPointAttempt} and applies two points to the scoring side on success.
 */
public interface TwoPointResolver {

  /**
   * @param scoringTeam the team that just scored the touchdown and is attempting the conversion
   * @param scoringSide which side of the game ledger the scoring team represents
   * @param gameId current game id (for stable event id construction)
   * @param sequence monotonic event sequence number
   * @param clock clock snapshot — two-point attempts don't consume game time in this model
   * @param scoreBeforeTry score after the TD itself but before the conversion points
   * @param rng randomness source
   */
  Resolved resolve(
      Team scoringTeam,
      Side scoringSide,
      GameId gameId,
      int sequence,
      GameClock clock,
      Score scoreBeforeTry,
      RandomSource rng);

  /** The two-point event plus the score after the attempt. */
  record Resolved(PlayEvent.TwoPointAttempt event, Score scoreAfter) {}
}
