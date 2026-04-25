package app.zoneblitz.gamesimulator.resolver.pass;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.GameInputs;
import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.environment.EnvironmentalModifiers;
import app.zoneblitz.gamesimulator.environment.HomeFieldAdvantage;
import app.zoneblitz.gamesimulator.environment.Roof;
import app.zoneblitz.gamesimulator.environment.Surface;
import app.zoneblitz.gamesimulator.environment.Weather;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.personnel.DefensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.playcalling.PlayCaller;
import app.zoneblitz.gamesimulator.resolver.PassOutcome;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class EnvironmentalPassResolverTests {

  private static final PlayerId QB = new PlayerId(new UUID(1L, 1L));
  private static final PlayerId TARGET = new PlayerId(new UUID(1L, 2L));

  @Test
  void resolve_heavyWeather_flipsSomeDeepCompletionsToIncomplete() {
    var delegate = alwaysComplete(40);
    var heavyWeather =
        new EnvironmentalPassResolver(
            delegate,
            EnvironmentalModifiers.from(
                new GameInputs.PreGameContext(
                    HomeFieldAdvantage.neutral(),
                    new Weather(60, 40, Weather.Precipitation.HEAVY_RAIN),
                    Surface.GRASS,
                    Roof.OPEN_AIR)));

    var incompletes = 0;
    var iterations = 500;
    for (var i = 0; i < iterations; i++) {
      var outcome =
          heavyWeather.resolve(null, null, null, null, new SplittableRandomSource(5000L + i));
      if (outcome instanceof PassOutcome.PassIncomplete) {
        incompletes++;
      }
    }

    assertThat(incompletes).isGreaterThan(0);
    assertThat(incompletes).isLessThan(iterations);
  }

  @Test
  void resolve_shortCompletions_areNotFlippedByWeather() {
    var delegate = alwaysComplete(5);
    var storm =
        new EnvironmentalPassResolver(
            delegate,
            EnvironmentalModifiers.from(
                new GameInputs.PreGameContext(
                    HomeFieldAdvantage.neutral(),
                    new Weather(40, 40, Weather.Precipitation.HEAVY_RAIN),
                    Surface.GRASS,
                    Roof.OPEN_AIR)));

    for (var i = 0; i < 200; i++) {
      var outcome = storm.resolve(null, null, null, null, new SplittableRandomSource(7000L + i));
      assertThat(outcome).isInstanceOf(PassOutcome.PassComplete.class);
    }
  }

  @Test
  void resolve_neutralModifiers_preservesDelegateOutcome() {
    var delegate = alwaysComplete(40);
    var wrapped = new EnvironmentalPassResolver(delegate, EnvironmentalModifiers.neutral());

    var outcome = wrapped.resolve(null, null, null, null, new SplittableRandomSource(1L));

    assertThat(outcome).isInstanceOf(PassOutcome.PassComplete.class);
  }

  private static PassResolver alwaysComplete(int airYards) {
    return new PassResolver() {
      @Override
      public PassOutcome resolve(
          PlayCaller.PlayCall call,
          GameState state,
          OffensivePersonnel offense,
          DefensivePersonnel defense,
          RandomSource rng) {
        return new PassOutcome.PassComplete(
            QB, TARGET, airYards, 0, airYards, Optional.empty(), List.of(), false);
      }
    };
  }
}
