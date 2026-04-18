package app.zoneblitz.gamesimulator.kickoff;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.KickoffResult;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.event.TeamId;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Team;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class OnsideAwareKickoffResolverTests {

  private static final PlayerId KICKER_ID = new PlayerId(new UUID(1L, 1L));
  private static final PlayerId KICK_COVER_ID = new PlayerId(new UUID(1L, 2L));
  private static final PlayerId RECEIVER_ID = new PlayerId(new UUID(2L, 1L));
  private static final Team KICKING =
      new Team(
          new TeamId(new UUID(1L, 0L)),
          "Kicking",
          List.of(
              new Player(KICKER_ID, Position.K, "Kicker"),
              new Player(KICK_COVER_ID, Position.LB, "Coverage")));
  private static final Team RECEIVING =
      new Team(
          new TeamId(new UUID(2L, 0L)),
          "Receiving",
          List.of(new Player(RECEIVER_ID, Position.WR, "Returner")));
  private static final GameId GAME = new GameId(new UUID(9L, 9L));
  private static final GameClock LATE_Q4 = new GameClock(4, 120);
  private static final Score AWAY_DOWN_SEVEN = new Score(21, 14);

  @Test
  void resolve_whenPolicyDeclines_delegatesToUnderlyingResolver() {
    var delegate = new TouchbackKickoffResolver();
    var resolver = new OnsideAwareKickoffResolver(delegate, (side, score, clock) -> false);

    var resolved =
        resolver.resolve(
            KICKING,
            RECEIVING,
            Side.HOME,
            GAME,
            1,
            LATE_Q4,
            AWAY_DOWN_SEVEN,
            new SplittableRandomSource(42L));

    assertThat(resolved.event().onside()).isFalse();
    assertThat(resolved.event().result()).isEqualTo(KickoffResult.TOUCHBACK);
    assertThat(resolved.nextPossession()).isEqualTo(Side.HOME);
  }

  @Test
  void resolve_whenPolicyAcceptsAndRngRecovers_assignsBallToKickingTeam() {
    var resolver =
        new OnsideAwareKickoffResolver(
            new TouchbackKickoffResolver(), (side, score, clock) -> true);

    var resolved =
        resolver.resolve(
            KICKING, RECEIVING, Side.HOME, GAME, 1, LATE_Q4, AWAY_DOWN_SEVEN, new FixedRng(0.0));

    assertThat(resolved.event().onside()).isTrue();
    assertThat(resolved.event().result()).isEqualTo(KickoffResult.ONSIDE_RECOVERED_BY_KICKING);
    assertThat(resolved.nextPossession()).isEqualTo(Side.AWAY);
    assertThat(resolved.nextSpotYardLine()).isEqualTo(45);
    assertThat(resolved.event().returner()).contains(KICK_COVER_ID);
    assertThat(resolved.event().kicker()).isEqualTo(KICKER_ID);
  }

  @Test
  void resolve_whenPolicyAcceptsAndRngFails_assignsBallToReceivingTeam() {
    var resolver =
        new OnsideAwareKickoffResolver(
            new TouchbackKickoffResolver(), (side, score, clock) -> true);

    var resolved =
        resolver.resolve(
            KICKING, RECEIVING, Side.HOME, GAME, 1, LATE_Q4, AWAY_DOWN_SEVEN, new FixedRng(0.5));

    assertThat(resolved.event().onside()).isTrue();
    assertThat(resolved.event().result()).isEqualTo(KickoffResult.ONSIDE_RECOVERED_BY_RECEIVING);
    assertThat(resolved.nextPossession()).isEqualTo(Side.HOME);
    assertThat(resolved.nextSpotYardLine()).isEqualTo(55);
    assertThat(resolved.event().returner()).contains(RECEIVER_ID);
  }

  @Test
  void resolve_overManyTrials_recoveryRateTracksTenPercent() {
    var resolver =
        new OnsideAwareKickoffResolver(
            new TouchbackKickoffResolver(), (side, score, clock) -> true);
    var rng = new SplittableRandomSource(7L);

    var trials = 20_000;
    var recoveries = 0;
    for (var i = 0; i < trials; i++) {
      var resolved =
          resolver.resolve(KICKING, RECEIVING, Side.HOME, GAME, i, LATE_Q4, AWAY_DOWN_SEVEN, rng);
      if (resolved.event().result() == KickoffResult.ONSIDE_RECOVERED_BY_KICKING) {
        recoveries++;
      }
    }
    var rate = (double) recoveries / trials;
    assertThat(rate).isBetween(0.085, 0.115);
  }

  /** Minimal deterministic {@link RandomSource} that returns a fixed {@code nextDouble}. */
  private static final class FixedRng implements RandomSource {
    private final double value;

    FixedRng(double value) {
      this.value = value;
    }

    @Override
    public long nextLong() {
      return 0L;
    }

    @Override
    public double nextDouble() {
      return value;
    }

    @Override
    public double nextGaussian() {
      return 0.0;
    }

    @Override
    public RandomSource split(long key) {
      return this;
    }
  }
}
