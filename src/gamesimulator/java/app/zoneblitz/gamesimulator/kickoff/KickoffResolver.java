package app.zoneblitz.gamesimulator.kickoff;

import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Team;

/**
 * Resolves a kickoff: produces a {@link PlayEvent.Kickoff} and reports the resulting field position
 * for the receiving team.
 */
public interface KickoffResolver {

  /**
   * @param kickingTeam team kicking off
   * @param receivingTeam team receiving
   * @param receivingSide which side ({@link Side#HOME} or {@link Side#AWAY}) is receiving
   * @param gameId the current game's id, used to build the {@link PlayEvent}'s stable id
   * @param sequence monotonic sequence number for the emitted event
   * @param clock game clock at the moment of the kickoff; baseline impls leave it unchanged
   * @param scoreAfter score to stamp on the emitted event
   * @param rng deterministic source for any sampled outcomes
   */
  Resolved resolve(
      Team kickingTeam,
      Team receivingTeam,
      Side receivingSide,
      GameId gameId,
      int sequence,
      GameClock clock,
      Score scoreAfter,
      RandomSource rng);

  /** The kickoff event plus the yard line the next snap will spot at (from receiving goal line). */
  record Resolved(PlayEvent.Kickoff event, int receivingSpotYardLine) {}
}
