package app.zoneblitz.gamesimulator.environment;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.GameInputs;
import org.junit.jupiter.api.Test;

class EnvironmentalModifiersTests {

  @Test
  void from_indoorDomeGrass_isNeutral() {
    var context =
        new GameInputs.PreGameContext(
            HomeFieldAdvantage.neutral(), Weather.indoor(), Surface.GRASS, Roof.DOME);

    var modifiers = EnvironmentalModifiers.from(context);

    assertThat(modifiers).isEqualTo(EnvironmentalModifiers.neutral());
  }

  @Test
  void from_domeShieldsWeatherEvenWithHurricaneInputs() {
    var storm = new Weather(70, 40, Weather.Precipitation.HEAVY_RAIN);
    var context =
        new GameInputs.PreGameContext(
            HomeFieldAdvantage.neutral(), storm, Surface.GRASS, Roof.DOME);

    var modifiers = EnvironmentalModifiers.from(context);

    assertThat(modifiers.kickAccuracyPenalty()).isZero();
    assertThat(modifiers.puntDistancePenalty()).isZero();
    assertThat(modifiers.deepPassCompletionPenalty()).isZero();
    assertThat(modifiers.fumbleRateBonus()).isZero();
  }

  @Test
  void from_strongWindOutdoors_raisesKickAndDeepPassPenalties() {
    var windy = new Weather(60, 30, Weather.Precipitation.NONE);
    var calm = new Weather(60, 0, Weather.Precipitation.NONE);

    var windyMods =
        EnvironmentalModifiers.from(
            new GameInputs.PreGameContext(
                HomeFieldAdvantage.neutral(), windy, Surface.GRASS, Roof.OPEN_AIR));
    var calmMods =
        EnvironmentalModifiers.from(
            new GameInputs.PreGameContext(
                HomeFieldAdvantage.neutral(), calm, Surface.GRASS, Roof.OPEN_AIR));

    assertThat(windyMods.kickAccuracyPenalty()).isGreaterThan(calmMods.kickAccuracyPenalty());
    assertThat(windyMods.puntDistancePenalty()).isGreaterThan(calmMods.puntDistancePenalty());
    assertThat(windyMods.deepPassCompletionPenalty())
        .isGreaterThan(calmMods.deepPassCompletionPenalty());
  }

  @Test
  void from_rain_raisesFumbleBonusAndDeepPassPenalty() {
    var dry = new Weather(60, 0, Weather.Precipitation.NONE);
    var rain = new Weather(60, 0, Weather.Precipitation.HEAVY_RAIN);

    var dryMods =
        EnvironmentalModifiers.from(
            new GameInputs.PreGameContext(
                HomeFieldAdvantage.neutral(), dry, Surface.GRASS, Roof.OPEN_AIR));
    var rainMods =
        EnvironmentalModifiers.from(
            new GameInputs.PreGameContext(
                HomeFieldAdvantage.neutral(), rain, Surface.GRASS, Roof.OPEN_AIR));

    assertThat(rainMods.fumbleRateBonus()).isGreaterThan(dryMods.fumbleRateBonus());
    assertThat(rainMods.deepPassCompletionPenalty())
        .isGreaterThan(dryMods.deepPassCompletionPenalty());
  }

  @Test
  void from_cold_shortensKickerRangeAndLiftsFumbleBonus() {
    var mild = new Weather(70, 0, Weather.Precipitation.NONE);
    var cold = new Weather(10, 0, Weather.Precipitation.NONE);

    var mildMods =
        EnvironmentalModifiers.from(
            new GameInputs.PreGameContext(
                HomeFieldAdvantage.neutral(), mild, Surface.GRASS, Roof.OPEN_AIR));
    var coldMods =
        EnvironmentalModifiers.from(
            new GameInputs.PreGameContext(
                HomeFieldAdvantage.neutral(), cold, Surface.GRASS, Roof.OPEN_AIR));

    assertThat(coldMods.kickerRangeYardsLost()).isGreaterThan(mildMods.kickerRangeYardsLost());
    assertThat(coldMods.fumbleRateBonus()).isGreaterThan(mildMods.fumbleRateBonus());
  }

  @Test
  void from_turf_raisesSpeedAndInjuryMultipliersVsGrass() {
    var calm = Weather.indoor();
    var grass =
        EnvironmentalModifiers.from(
            new GameInputs.PreGameContext(
                HomeFieldAdvantage.neutral(), calm, Surface.GRASS, Roof.DOME));
    var turf =
        EnvironmentalModifiers.from(
            new GameInputs.PreGameContext(
                HomeFieldAdvantage.neutral(), calm, Surface.TURF, Roof.DOME));

    assertThat(turf.speedMultiplier()).isGreaterThan(grass.speedMultiplier());
    assertThat(turf.injuryRateMultiplier()).isGreaterThan(grass.injuryRateMultiplier());
  }
}
