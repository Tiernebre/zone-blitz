package app.zoneblitz.gamesimulator.scoring;

import app.zoneblitz.gamesimulator.event.DownAndDistance;
import app.zoneblitz.gamesimulator.event.FieldPosition;
import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.PlayId;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.event.TwoPointPlay;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Team;
import java.util.Objects;
import java.util.UUID;

/**
 * Baseline two-point resolver: flat success rate regardless of personnel, plus an independent
 * run-vs-pass sub-decision. Default rate is 0.48 — within the published 2015-2023 NFL league-wide
 * conversion clip. Default run share is 0.40 — leaguewide two-point calls run slightly pass-heavy.
 * Defensive return on a failed try (modern 2-point defensive score) is intentionally not modeled;
 * see issue #574 out-of-scope note.
 */
public final class FlatRateTwoPointResolver implements TwoPointResolver {

  public static final double DEFAULT_SUCCESS_RATE = 0.48;
  public static final double DEFAULT_RUN_SHARE = 0.40;

  private final double successRate;
  private final double runShare;

  public FlatRateTwoPointResolver() {
    this(DEFAULT_SUCCESS_RATE, DEFAULT_RUN_SHARE);
  }

  public FlatRateTwoPointResolver(double successRate, double runShare) {
    if (successRate < 0.0 || successRate > 1.0) {
      throw new IllegalArgumentException("successRate must be in [0, 1], got " + successRate);
    }
    if (runShare < 0.0 || runShare > 1.0) {
      throw new IllegalArgumentException("runShare must be in [0, 1], got " + runShare);
    }
    this.successRate = successRate;
    this.runShare = runShare;
  }

  @Override
  public Resolved resolve(
      Team scoringTeam,
      Side scoringSide,
      GameId gameId,
      int sequence,
      GameClock clock,
      Score scoreBeforeTry,
      RandomSource rng) {
    Objects.requireNonNull(scoringTeam, "scoringTeam");
    Objects.requireNonNull(scoringSide, "scoringSide");
    Objects.requireNonNull(gameId, "gameId");
    Objects.requireNonNull(clock, "clock");
    Objects.requireNonNull(scoreBeforeTry, "scoreBeforeTry");
    Objects.requireNonNull(rng, "rng");

    var play = rng.nextDouble() < runShare ? TwoPointPlay.RUN : TwoPointPlay.PASS;
    var succeeded = rng.nextDouble() < successRate;
    var scoreAfter = succeeded ? scoreBeforeTry.plus(scoringSide, 2) : scoreBeforeTry;
    var id = new PlayId(new UUID(gameId.value().getMostSignificantBits(), 0xFB00L | sequence));
    var event =
        new PlayEvent.TwoPointAttempt(
            id,
            gameId,
            sequence,
            new DownAndDistance(0, 0),
            new FieldPosition(98),
            clock,
            clock,
            scoreAfter,
            play,
            succeeded);
    return new Resolved(event, scoreAfter);
  }
}
