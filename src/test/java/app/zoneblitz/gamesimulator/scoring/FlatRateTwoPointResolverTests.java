package app.zoneblitz.gamesimulator.scoring;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.event.TeamId;
import app.zoneblitz.gamesimulator.event.TwoPointPlay;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Team;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class FlatRateTwoPointResolverTests {

  private static final Team TEAM =
      new Team(
          new TeamId(new UUID(1L, 1L)),
          "T",
          List.of(new Player(new PlayerId(new UUID(1L, 2L)), Position.QB, "QB")));
  private static final GameId GAME = new GameId(new UUID(7L, 7L));

  @Test
  void resolve_certainSuccess_addsTwoToScoringSide() {
    TwoPointResolver resolver = new FlatRateTwoPointResolver(1.0, 0.5);

    var resolved =
        resolver.resolve(
            TEAM,
            Side.HOME,
            GAME,
            0,
            new GameClock(4, 60),
            new Score(18, 21),
            new SplittableRandomSource(42L));

    assertThat(resolved.event().success()).isTrue();
    assertThat(resolved.scoreAfter()).isEqualTo(new Score(20, 21));
  }

  @Test
  void resolve_certainFailure_leavesScoreUnchanged() {
    TwoPointResolver resolver = new FlatRateTwoPointResolver(0.0, 0.5);

    var resolved =
        resolver.resolve(
            TEAM,
            Side.AWAY,
            GAME,
            3,
            new GameClock(4, 60),
            new Score(21, 18),
            new SplittableRandomSource(42L));

    assertThat(resolved.event().success()).isFalse();
    assertThat(resolved.scoreAfter()).isEqualTo(new Score(21, 18));
  }

  @Test
  void resolve_certainRun_emitsRunPlay() {
    TwoPointResolver resolver = new FlatRateTwoPointResolver(0.5, 1.0);

    var resolved =
        resolver.resolve(
            TEAM,
            Side.HOME,
            GAME,
            0,
            new GameClock(4, 60),
            new Score(18, 21),
            new SplittableRandomSource(42L));

    assertThat(resolved.event().play()).isEqualTo(TwoPointPlay.RUN);
  }

  @Test
  void resolve_certainPass_emitsPassPlay() {
    TwoPointResolver resolver = new FlatRateTwoPointResolver(0.5, 0.0);

    var resolved =
        resolver.resolve(
            TEAM,
            Side.HOME,
            GAME,
            0,
            new GameClock(4, 60),
            new Score(18, 21),
            new SplittableRandomSource(42L));

    assertThat(resolved.event().play()).isEqualTo(TwoPointPlay.PASS);
  }

  @Test
  void resolve_defaultRate_approximatesLeagueAverageOverMany() {
    TwoPointResolver resolver = new FlatRateTwoPointResolver();
    var made = 0;
    for (var i = 0; i < 5_000; i++) {
      var r =
          resolver.resolve(
              TEAM,
              Side.HOME,
              GAME,
              i,
              new GameClock(4, 60),
              new Score(18, 21),
              new SplittableRandomSource(i));
      if (r.event().success()) {
        made++;
      }
    }
    var rate = made / 5000.0;
    assertThat(rate).isBetween(0.44, 0.52);
  }

  @Test
  void construct_invalidSuccessRate_throws() {
    assertThatIllegalArgumentException().isThrownBy(() -> new FlatRateTwoPointResolver(-0.1, 0.4));
    assertThatIllegalArgumentException().isThrownBy(() -> new FlatRateTwoPointResolver(1.1, 0.4));
  }

  @Test
  void construct_invalidRunShare_throws() {
    assertThatIllegalArgumentException().isThrownBy(() -> new FlatRateTwoPointResolver(0.5, -0.1));
    assertThatIllegalArgumentException().isThrownBy(() -> new FlatRateTwoPointResolver(0.5, 1.1));
  }
}
