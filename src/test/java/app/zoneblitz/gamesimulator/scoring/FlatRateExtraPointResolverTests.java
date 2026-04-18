package app.zoneblitz.gamesimulator.scoring;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.PatResult;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.event.TeamId;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Team;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class FlatRateExtraPointResolverTests {

  private static final Team TEAM =
      new Team(
          new TeamId(new UUID(1L, 1L)),
          "T",
          List.of(new Player(new PlayerId(new UUID(1L, 2L)), Position.K, "Kicker")));
  private static final GameId GAME = new GameId(new UUID(7L, 7L));

  @Test
  void resolve_certainMake_addsOneToScoringSide() {
    var resolver = new FlatRateExtraPointResolver(1.0);

    var resolved =
        resolver.resolve(
            TEAM,
            Side.HOME,
            GAME,
            0,
            new GameClock(1, 600),
            new Score(6, 0),
            new SplittableRandomSource(42L));

    assertThat(resolved.event().result()).isEqualTo(PatResult.GOOD);
    assertThat(resolved.scoreAfter()).isEqualTo(new Score(7, 0));
  }

  @Test
  void resolve_certainMiss_leavesScoreUnchanged() {
    var resolver = new FlatRateExtraPointResolver(0.0);

    var resolved =
        resolver.resolve(
            TEAM,
            Side.AWAY,
            GAME,
            1,
            new GameClock(1, 600),
            new Score(0, 6),
            new SplittableRandomSource(42L));

    assertThat(resolved.event().result()).isEqualTo(PatResult.MISSED);
    assertThat(resolved.scoreAfter()).isEqualTo(new Score(0, 6));
  }

  @Test
  void resolve_defaultRate_approximatesLeagueAverageOverMany() {
    var resolver = new FlatRateExtraPointResolver();
    var made = 0;
    for (var i = 0; i < 5_000; i++) {
      var r =
          resolver.resolve(
              TEAM,
              Side.HOME,
              GAME,
              i,
              new GameClock(1, 600),
              new Score(0, 0),
              new SplittableRandomSource(i));
      if (r.event().result() == PatResult.GOOD) {
        made++;
      }
    }
    var rate = made / 5000.0;
    assertThat(rate).isBetween(0.92, 0.96);
  }

  @Test
  void construct_invalidRate_throws() {
    assertThatIllegalArgumentException().isThrownBy(() -> new FlatRateExtraPointResolver(-0.1));
    assertThatIllegalArgumentException().isThrownBy(() -> new FlatRateExtraPointResolver(1.1));
  }
}
