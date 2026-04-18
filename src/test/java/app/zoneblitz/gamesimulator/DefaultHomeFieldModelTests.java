package app.zoneblitz.gamesimulator;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.event.PenaltyType;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.personnel.TestPersonnel;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import org.junit.jupiter.api.Test;

class DefaultHomeFieldModelTests {

  private HomeFieldModel model = new DefaultHomeFieldModel();

  @Test
  void drawRoadPreSnapPenalty_homeOffense_returnsEmpty() {
    var rng = new SplittableRandomSource(1L);
    for (var i = 0; i < 100; i++) {
      var draw =
          model.drawRoadPreSnapPenalty(
              Side.HOME, TestPersonnel.baselineOffense(), HomeFieldAdvantage.leagueAverage(), rng);
      assertThat(draw).isEmpty();
    }
  }

  @Test
  void drawRoadPreSnapPenalty_neutralAdvantage_returnsEmpty() {
    var rng = new SplittableRandomSource(1L);
    for (var i = 0; i < 100; i++) {
      var draw =
          model.drawRoadPreSnapPenalty(
              Side.AWAY, TestPersonnel.baselineOffense(), HomeFieldAdvantage.neutral(), rng);
      assertThat(draw).isEmpty();
    }
  }

  @Test
  void drawRoadPreSnapPenalty_roadOffenseLoudStadium_firesMoreThanQuietStadium() {
    var loud = countFires(new HomeFieldAdvantage(100), 20_000, 17L);
    var quiet = countFires(new HomeFieldAdvantage(10), 20_000, 17L);
    assertThat(loud).isGreaterThan(quiet);
  }

  @Test
  void drawRoadPreSnapPenalty_fires_flagsAgainstRoadOffense() {
    var rng = new SplittableRandomSource(42L);
    var fired = false;
    for (var i = 0; i < 5_000 && !fired; i++) {
      var draw =
          model.drawRoadPreSnapPenalty(
              Side.AWAY,
              TestPersonnel.baselineOffense(),
              HomeFieldAdvantage.leagueAverage(),
              rng.split(i));
      if (draw.isPresent()) {
        assertThat(draw.get().against()).isEqualTo(Side.AWAY);
        assertThat(draw.get().type())
            .isIn(
                PenaltyType.FALSE_START, PenaltyType.DELAY_OF_GAME, PenaltyType.ILLEGAL_FORMATION);
        assertThat(draw.get().yards()).isEqualTo(5);
        fired = true;
      }
    }
    assertThat(fired).isTrue();
  }

  @Test
  void drawRoadPreSnapPenalty_leagueAverage_matchesConfiguredRate() {
    var fires = countFires(HomeFieldAdvantage.leagueAverage(), 50_000, 99L);
    var observedRate = fires / 50_000.0;
    assertThat(observedRate)
        .isCloseTo(DefaultHomeFieldModel.LEAGUE_AVERAGE_BONUS_RATE, within(0.006));
  }

  private int countFires(HomeFieldAdvantage hfa, int trials, long seed) {
    var rng = new SplittableRandomSource(seed);
    var fires = 0;
    for (var i = 0; i < trials; i++) {
      var draw =
          model.drawRoadPreSnapPenalty(
              Side.AWAY, TestPersonnel.baselineOffense(), hfa, rng.split(i));
      if (draw.isPresent()) {
        fires++;
      }
    }
    return fires;
  }

  private static org.assertj.core.data.Offset<Double> within(double v) {
    return org.assertj.core.data.Offset.offset(v);
  }
}
