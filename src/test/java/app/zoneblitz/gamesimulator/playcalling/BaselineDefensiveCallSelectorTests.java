package app.zoneblitz.gamesimulator.playcalling;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.TestGameStates;
import app.zoneblitz.gamesimulator.band.ClasspathBandRepository;
import app.zoneblitz.gamesimulator.formation.OffensiveFormation;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import app.zoneblitz.gamesimulator.roster.DefensiveCoachTendencies;
import org.junit.jupiter.api.Test;

class BaselineDefensiveCallSelectorTests {

  private static final int SAMPLES = 5_000;

  private final BaselineDefensiveCallSelector selector =
      BaselineDefensiveCallSelector.load(new ClasspathBandRepository());

  @Test
  void neutralDc_blitzRateReproducesLeagueBaseline() {
    var state = state(1, 10, 50);
    var blitzes = countBlitz(state, OffensiveFormation.SHOTGUN, average(), 11L);

    var rate = blitzes / (double) SAMPLES;
    assertThat(rate).isBetween(0.22, 0.38);
  }

  @Test
  void highBlitzFrequency_raisesBlitzRate() {
    var state = state(1, 10, 50);
    var neutral = countBlitz(state, OffensiveFormation.SHOTGUN, average(), 22L);
    var aggressive = countBlitz(state, OffensiveFormation.SHOTGUN, withBlitzFrequency(95), 22L);

    assertThat(aggressive).isGreaterThan(neutral + SAMPLES / 10);
  }

  @Test
  void thirdAndLong_raisesBlitzRateVsFirstAndTen() {
    var firstAndTen = state(1, 10, 50);
    var thirdAndLong = state(3, 12, 50);

    var first = countBlitz(firstAndTen, OffensiveFormation.SHOTGUN, average(), 33L);
    var third = countBlitz(thirdAndLong, OffensiveFormation.SHOTGUN, average(), 33L);

    assertThat(third).isGreaterThan(first);
  }

  @Test
  void goalToGoShortYardage_alwaysGoalLinePersonnel() {
    var state = state(2, 1, 98);
    var rng = new SplittableRandomSource(44L);
    for (var i = 0; i < 100; i++) {
      var call = selector.select(state, OffensiveFormation.I_FORM, average(), rng.split(i));
      assertThat(call.personnelPackage()).isEqualTo(DefensivePackage.GOAL_LINE);
    }
  }

  @Test
  void highManZoneBias_increasesManCoverageShare() {
    var state = state(1, 10, 50);
    var manNeutral = countMan(state, OffensiveFormation.SHOTGUN, average(), 55L);
    var manAggressive = countMan(state, OffensiveFormation.SHOTGUN, withManBias(95), 55L);

    assertThat(manAggressive).isGreaterThan(manNeutral + SAMPLES / 10);
  }

  private int countBlitz(
      GameState state, OffensiveFormation formation, DefensiveCoachTendencies dc, long seed) {
    var rng = new SplittableRandomSource(seed);
    var blitzes = 0;
    for (var i = 0; i < SAMPLES; i++) {
      var call = selector.select(state, formation, dc, rng.split(i));
      if (call.extraRushers() > 0) {
        blitzes++;
      }
    }
    return blitzes;
  }

  private int countMan(
      GameState state, OffensiveFormation formation, DefensiveCoachTendencies dc, long seed) {
    var rng = new SplittableRandomSource(seed);
    var mans = 0;
    for (var i = 0; i < SAMPLES; i++) {
      var call = selector.select(state, formation, dc, rng.split(i));
      if (call.manZone() == ManZone.MAN) {
        mans++;
      }
    }
    return mans;
  }

  private static DefensiveCoachTendencies average() {
    return DefensiveCoachTendencies.average();
  }

  private static DefensiveCoachTendencies withBlitzFrequency(int value) {
    return new DefensiveCoachTendencies(value, 50, 50, 50, 50, 50, 50, 50);
  }

  private static DefensiveCoachTendencies withManBias(int value) {
    return new DefensiveCoachTendencies(50, 50, 50, value, 50, 50, 50, 50);
  }

  private static GameState state(int down, int dist, int yardLine) {
    return TestGameStates.neutral(down, dist, yardLine);
  }
}
