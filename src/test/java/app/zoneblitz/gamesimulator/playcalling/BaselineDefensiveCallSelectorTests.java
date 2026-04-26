package app.zoneblitz.gamesimulator.playcalling;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.TestGameStates;
import app.zoneblitz.gamesimulator.adjustments.GameStats;
import app.zoneblitz.gamesimulator.adjustments.TeamPlayLog;
import app.zoneblitz.gamesimulator.band.ClasspathBandRepository;
import app.zoneblitz.gamesimulator.formation.CoverageShell;
import app.zoneblitz.gamesimulator.formation.OffensiveFormation;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import app.zoneblitz.gamesimulator.roster.DefensiveCoachTendencies;
import java.util.List;
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
      var call =
          selector.select(
              state,
              OffensiveFormation.I_FORM,
              average(),
              app.zoneblitz.gamesimulator.roster.RosterProfile.leagueAverage(),
              rng.split(i));
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

  @Test
  void offenseRunningWell_raisesBlitzRateOverEmptyStatsBaseline() {
    var emptyState = state(1, 10, 50);
    var hotRunState = emptyState.withStats(homeRunHumming());

    var emptyBlitzes = countBlitz(emptyState, OffensiveFormation.SHOTGUN, average(), 77L);
    var hotBlitzes = countBlitz(hotRunState, OffensiveFormation.SHOTGUN, average(), 77L);

    assertThat(hotBlitzes).isGreaterThan(emptyBlitzes + SAMPLES / 25);
  }

  @Test
  void offensePassingWell_increasesTwoHighShellShare() {
    var emptyState = state(1, 10, 50);
    var hotPassState = emptyState.withStats(homePassHumming());

    var emptyTwoHigh = countTwoHigh(emptyState, OffensiveFormation.SHOTGUN, average(), 88L);
    var hotTwoHigh = countTwoHigh(hotPassState, OffensiveFormation.SHOTGUN, average(), 88L);

    assertThat(hotTwoHigh).isGreaterThan(emptyTwoHigh + SAMPLES / 50);
  }

  @Test
  void stubbornDc_dampensTheStatsBasedShift() {
    var hotRunState = state(1, 10, 50).withStats(homeRunHumming());

    var reactiveBlitzes =
        countBlitz(
            hotRunState,
            OffensiveFormation.SHOTGUN,
            new DefensiveCoachTendencies(50, 50, 50, 50, 50, 50, 50, 50, 100),
            99L);
    var stubbornBlitzes =
        countBlitz(
            hotRunState,
            OffensiveFormation.SHOTGUN,
            new DefensiveCoachTendencies(50, 50, 50, 50, 50, 50, 50, 50, 0),
            99L);

    assertThat(stubbornBlitzes).isLessThan(reactiveBlitzes);
  }

  private int countTwoHigh(
      GameState state, OffensiveFormation formation, DefensiveCoachTendencies dc, long seed) {
    var rng = new SplittableRandomSource(seed);
    var twoHigh = 0;
    for (var i = 0; i < SAMPLES; i++) {
      var call =
          selector.select(
              state,
              formation,
              dc,
              app.zoneblitz.gamesimulator.roster.RosterProfile.leagueAverage(),
              rng.split(i));
      if (isTwoHigh(call.shell())) {
        twoHigh++;
      }
    }
    return twoHigh;
  }

  private static boolean isTwoHigh(CoverageShell shell) {
    return switch (shell) {
      case COVER_2, COVER_6, TWO_MAN, QUARTERS -> true;
      default -> false;
    };
  }

  private static GameStats homeRunHumming() {
    var hot = new TeamPlayLog(0, 0, 0, 0, 0, 10, 70, 0, 0, 0, 0, List.of());
    return new GameStats(hot, TeamPlayLog.empty());
  }

  private static GameStats homePassHumming() {
    var hot = new TeamPlayLog(10, 90, 7, 0, 0, 0, 0, 0, 0, 0, 0, List.of());
    return new GameStats(hot, TeamPlayLog.empty());
  }

  private int countBlitz(
      GameState state, OffensiveFormation formation, DefensiveCoachTendencies dc, long seed) {
    var rng = new SplittableRandomSource(seed);
    var blitzes = 0;
    for (var i = 0; i < SAMPLES; i++) {
      var call =
          selector.select(
              state,
              formation,
              dc,
              app.zoneblitz.gamesimulator.roster.RosterProfile.leagueAverage(),
              rng.split(i));
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
      var call =
          selector.select(
              state,
              formation,
              dc,
              app.zoneblitz.gamesimulator.roster.RosterProfile.leagueAverage(),
              rng.split(i));
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
    return new DefensiveCoachTendencies(value, 50, 50, 50, 50, 50, 50, 50, 50);
  }

  private static DefensiveCoachTendencies withManBias(int value) {
    return new DefensiveCoachTendencies(50, 50, 50, value, 50, 50, 50, 50, 50);
  }

  private static GameState state(int down, int dist, int yardLine) {
    return TestGameStates.neutral(down, dist, yardLine);
  }
}
