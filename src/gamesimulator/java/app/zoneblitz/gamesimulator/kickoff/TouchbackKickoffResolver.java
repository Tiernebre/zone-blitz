package app.zoneblitz.gamesimulator.kickoff;

import app.zoneblitz.gamesimulator.event.DownAndDistance;
import app.zoneblitz.gamesimulator.event.FieldPosition;
import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.KickoffResult;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.PlayId;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Team;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/**
 * Always-touchback kickoff resolver. The receiving team starts at its own 30 (2024+ dynamic kickoff
 * rule). Ball doesn't come out, no return yards. Zero clock time consumed.
 */
public final class TouchbackKickoffResolver implements KickoffResolver {

  private static final int TOUCHBACK_SPOT = 30;

  @Override
  public Resolved resolve(
      Team kickingTeam,
      Team receivingTeam,
      Side receivingSide,
      GameId gameId,
      int sequence,
      GameClock clock,
      Score scoreAfter,
      RandomSource rng) {
    Objects.requireNonNull(kickingTeam, "kickingTeam");
    Objects.requireNonNull(receivingTeam, "receivingTeam");
    Objects.requireNonNull(gameId, "gameId");
    Objects.requireNonNull(clock, "clock");
    Objects.requireNonNull(scoreAfter, "scoreAfter");
    var kicker = pickKicker(kickingTeam);
    var id = new PlayId(new UUID(gameId.value().getMostSignificantBits(), 0xFF00L | sequence));
    var event =
        new PlayEvent.Kickoff(
            id,
            gameId,
            sequence,
            new DownAndDistance(1, 10),
            new FieldPosition(35),
            clock,
            clock,
            scoreAfter,
            kicker,
            KickoffResult.TOUCHBACK,
            Optional.empty(),
            0,
            false);
    return new Resolved(event, TOUCHBACK_SPOT);
  }

  private static PlayerId pickKicker(Team team) {
    return team.roster().stream()
        .filter(p -> p.position() == Position.K)
        .map(p -> p.id())
        .findFirst()
        .orElseGet(() -> team.roster().get(0).id());
  }
}
