package app.zoneblitz.gamesimulator.punt;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.EnvironmentalModifiers;
import app.zoneblitz.gamesimulator.GameInputs;
import app.zoneblitz.gamesimulator.HomeFieldAdvantage;
import app.zoneblitz.gamesimulator.Roof;
import app.zoneblitz.gamesimulator.Surface;
import app.zoneblitz.gamesimulator.Weather;
import app.zoneblitz.gamesimulator.band.ClasspathBandRepository;
import app.zoneblitz.gamesimulator.band.DefaultBandSampler;
import app.zoneblitz.gamesimulator.event.DownAndDistance;
import app.zoneblitz.gamesimulator.event.FieldPosition;
import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.GameId;
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

class EnvironmentalPuntResolverTests {

  private static final Team KICKING =
      new Team(
          new TeamId(new UUID(1L, 1L)),
          "Kick",
          List.of(
              new Player(new PlayerId(new UUID(1L, 10L)), Position.P, "Punter"),
              new Player(new PlayerId(new UUID(1L, 11L)), Position.K, "Kicker")));
  private static final Team RECEIVING =
      new Team(
          new TeamId(new UUID(2L, 2L)),
          "Recv",
          List.of(
              new Player(new PlayerId(new UUID(2L, 20L)), Position.WR, "Returner"),
              new Player(new PlayerId(new UUID(2L, 21L)), Position.CB, "CB")));
  private static final GameId GAME = new GameId(new UUID(9L, 9L));

  @Test
  void resolve_strongWind_reducesAverageGrossYards() {
    var repo = new ClasspathBandRepository();
    var sampler = new DefaultBandSampler();
    var delegate = BandPuntResolver.load(repo, sampler);
    var calm = new EnvironmentalPuntResolver(delegate, EnvironmentalModifiers.neutral());
    var windy =
        new EnvironmentalPuntResolver(
            delegate,
            EnvironmentalModifiers.from(
                new GameInputs.PreGameContext(
                    HomeFieldAdvantage.neutral(),
                    new Weather(60, 35, Weather.Precipitation.NONE),
                    Surface.GRASS,
                    Roof.OPEN_AIR)));

    var calmAvg = averageGross(calm, 500);
    var windyAvg = averageGross(windy, 500);

    assertThat(windyAvg).isLessThan(calmAvg);
  }

  @Test
  void resolve_neutralModifiers_preservesDelegateResult() {
    var repo = new ClasspathBandRepository();
    var sampler = new DefaultBandSampler();
    var delegate = BandPuntResolver.load(repo, sampler);
    var wrapped = new EnvironmentalPuntResolver(delegate, EnvironmentalModifiers.neutral());

    var base =
        delegate.resolve(
            KICKING,
            RECEIVING,
            Side.HOME,
            GAME,
            0,
            new FieldPosition(30),
            new DownAndDistance(4, 8),
            new GameClock(2, 120),
            new Score(7, 3),
            new SplittableRandomSource(123L));
    var decorated =
        wrapped.resolve(
            KICKING,
            RECEIVING,
            Side.HOME,
            GAME,
            0,
            new FieldPosition(30),
            new DownAndDistance(4, 8),
            new GameClock(2, 120),
            new Score(7, 3),
            new SplittableRandomSource(123L));

    assertThat(decorated.event().grossYards()).isEqualTo(base.event().grossYards());
    assertThat(decorated.receivingTakeoverYardLine()).isEqualTo(base.receivingTakeoverYardLine());
    assertThat(decorated.event().result()).isEqualTo(base.event().result());
  }

  private static double averageGross(PuntResolver resolver, int iterations) {
    var sum = 0L;
    for (var i = 0; i < iterations; i++) {
      var resolved =
          resolver.resolve(
              KICKING,
              RECEIVING,
              Side.HOME,
              GAME,
              i,
              new FieldPosition(30),
              new DownAndDistance(4, 8),
              new GameClock(2, 120),
              new Score(7, 3),
              new SplittableRandomSource(1000L + i));
      sum += resolved.event().grossYards();
    }
    return sum / (double) iterations;
  }
}
