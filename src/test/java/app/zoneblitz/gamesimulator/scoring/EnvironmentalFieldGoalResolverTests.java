package app.zoneblitz.gamesimulator.scoring;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.EnvironmentalModifiers;
import app.zoneblitz.gamesimulator.GameInputs;
import app.zoneblitz.gamesimulator.HomeFieldAdvantage;
import app.zoneblitz.gamesimulator.Roof;
import app.zoneblitz.gamesimulator.Surface;
import app.zoneblitz.gamesimulator.Weather;
import app.zoneblitz.gamesimulator.event.DownAndDistance;
import app.zoneblitz.gamesimulator.event.FieldGoalResult;
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

class EnvironmentalFieldGoalResolverTests {

  private static final Team TEAM =
      new Team(
          new TeamId(new UUID(1L, 1L)),
          "T",
          List.of(new Player(new PlayerId(new UUID(1L, 2L)), Position.K, "Kicker")));
  private static final GameId GAME = new GameId(new UUID(9L, 9L));

  @Test
  void resolve_strongWind_cutsLongMakeRateBelowCalmBaseline() {
    var baseResolver = new DistanceCurveFieldGoalResolver();
    var calm = new EnvironmentalFieldGoalResolver(baseResolver, EnvironmentalModifiers.neutral());
    var windy =
        new EnvironmentalFieldGoalResolver(
            baseResolver,
            EnvironmentalModifiers.from(
                new GameInputs.PreGameContext(
                    HomeFieldAdvantage.neutral(),
                    new Weather(60, 30, Weather.Precipitation.NONE),
                    Surface.GRASS,
                    Roof.OPEN_AIR)));

    var calmMakes = countMakesFromYardLine(calm, 60, 2000);
    var windyMakes = countMakesFromYardLine(windy, 60, 2000);

    assertThat(windyMakes).isLessThan(calmMakes);
  }

  @Test
  void resolve_cold_zeroesOutKicksBeyondShortenedRange() {
    // Never-miss delegate so every difference is attributable to the cold-range gate.
    var alwaysMake = new DistanceCurveFieldGoalResolver(d -> 1.0);
    var freezing =
        new EnvironmentalFieldGoalResolver(
            alwaysMake,
            EnvironmentalModifiers.from(
                new GameInputs.PreGameContext(
                    HomeFieldAdvantage.neutral(),
                    new Weather(-10, 0, Weather.Precipitation.NONE),
                    Surface.GRASS,
                    Roof.OPEN_AIR)));

    // 80-yard-line LOS ⇒ 37-yard kick: inside the shortened range. Always make.
    var shortResolved = resolveAt(freezing, 80);
    assertThat(shortResolved.made()).isTrue();
    assertThat(shortResolved.event().result()).isEqualTo(FieldGoalResult.GOOD);

    // 40-yard-line LOS ⇒ 77-yard kick: well beyond any range. Should always miss.
    var longResolved = resolveAt(freezing, 40);
    assertThat(longResolved.made()).isFalse();
    assertThat(longResolved.event().result()).isEqualTo(FieldGoalResult.MISSED);
  }

  @Test
  void resolve_neutralModifiers_passesDelegateResultThrough() {
    var delegate = new DistanceCurveFieldGoalResolver(d -> 1.0);
    var wrapped = new EnvironmentalFieldGoalResolver(delegate, EnvironmentalModifiers.neutral());

    var resolved = resolveAt(wrapped, 80);

    assertThat(resolved.made()).isTrue();
    assertThat(resolved.scoreAfter()).isEqualTo(new Score(3, 0));
  }

  private static int countMakesFromYardLine(
      FieldGoalResolver resolver, int yardLine, int iterations) {
    var makes = 0;
    for (var i = 0; i < iterations; i++) {
      var resolved =
          resolver.resolve(
              TEAM,
              Side.HOME,
              GAME,
              i,
              new FieldPosition(yardLine),
              new DownAndDistance(4, 5),
              new GameClock(4, 60),
              new Score(0, 0),
              new SplittableRandomSource(42L + i));
      if (resolved.made()) {
        makes++;
      }
    }
    return makes;
  }

  private static FieldGoalResolver.Resolved resolveAt(FieldGoalResolver resolver, int yardLine) {
    return resolver.resolve(
        TEAM,
        Side.HOME,
        GAME,
        0,
        new FieldPosition(yardLine),
        new DownAndDistance(4, 5),
        new GameClock(4, 60),
        new Score(0, 0),
        new SplittableRandomSource(7L));
  }
}
