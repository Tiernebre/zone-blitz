package app.zoneblitz.gamesimulator.scoring;

import app.zoneblitz.gamesimulator.event.DownAndDistance;
import app.zoneblitz.gamesimulator.event.FieldPosition;
import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.PatResult;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.PlayId;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Team;
import java.util.Objects;
import java.util.UUID;

/**
 * Baseline PAT resolver: single flat make-rate regardless of kicker, defense, or conditions.
 * Default rate is 0.94 — matches the post-2015 NFL league-wide clip within a percentage point.
 * Block rate and miss breakdown are not modeled; every failure is {@link PatResult#MISSED}.
 */
public final class FlatRateExtraPointResolver implements ExtraPointResolver {

  public static final double DEFAULT_MAKE_RATE = 0.94;

  private final double makeRate;

  public FlatRateExtraPointResolver() {
    this(DEFAULT_MAKE_RATE);
  }

  public FlatRateExtraPointResolver(double makeRate) {
    if (makeRate < 0.0 || makeRate > 1.0) {
      throw new IllegalArgumentException("makeRate must be in [0, 1], got " + makeRate);
    }
    this.makeRate = makeRate;
  }

  @Override
  public Resolved resolve(
      Team kickingTeam,
      Side kickingSide,
      GameId gameId,
      int sequence,
      GameClock clock,
      Score scoreBeforePat,
      RandomSource rng) {
    Objects.requireNonNull(kickingTeam, "kickingTeam");
    Objects.requireNonNull(kickingSide, "kickingSide");
    Objects.requireNonNull(gameId, "gameId");
    Objects.requireNonNull(clock, "clock");
    Objects.requireNonNull(scoreBeforePat, "scoreBeforePat");
    Objects.requireNonNull(rng, "rng");

    var made = rng.nextDouble() < makeRate;
    var result = made ? PatResult.GOOD : PatResult.MISSED;
    var scoreAfter = made ? scoreBeforePat.plus(kickingSide, 1) : scoreBeforePat;
    var kicker = pickKicker(kickingTeam);
    var id = new PlayId(new UUID(gameId.value().getMostSignificantBits(), 0xFA00L | sequence));
    var event =
        new PlayEvent.ExtraPoint(
            id,
            gameId,
            sequence,
            new DownAndDistance(0, 0),
            new FieldPosition(85),
            clock,
            clock,
            scoreAfter,
            kicker,
            result);
    return new Resolved(event, scoreAfter);
  }

  private static PlayerId pickKicker(Team team) {
    return team.roster().stream()
        .filter(p -> p.position() == Position.K)
        .map(p -> p.id())
        .findFirst()
        .orElseGet(() -> team.roster().get(0).id());
  }
}
