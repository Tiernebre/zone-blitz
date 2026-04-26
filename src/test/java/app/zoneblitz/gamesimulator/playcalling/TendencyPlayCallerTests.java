package app.zoneblitz.gamesimulator.playcalling;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.TestGameStates;
import app.zoneblitz.gamesimulator.adjustments.GameStats;
import app.zoneblitz.gamesimulator.adjustments.PlayKind;
import app.zoneblitz.gamesimulator.adjustments.TeamPlayLog;
import app.zoneblitz.gamesimulator.band.ClasspathBandRepository;
import app.zoneblitz.gamesimulator.event.PassConcept;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import app.zoneblitz.gamesimulator.roster.Coach;
import app.zoneblitz.gamesimulator.roster.CoachId;
import app.zoneblitz.gamesimulator.roster.CoachQuality;
import app.zoneblitz.gamesimulator.roster.CoachTendencies;
import app.zoneblitz.gamesimulator.roster.DefensiveCoachTendencies;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class TendencyPlayCallerTests {

  private static final int SAMPLES = 5_000;

  private final TendencyPlayCaller caller = TendencyPlayCaller.load(new ClasspathBandRepository());

  @Test
  void neutralCoachOn3rdAnd1_dominantlyRuns() {
    var state = state(3, 1, 50, 1, 600);
    var passes = countPasses(state, neutralCoach(), 1L);

    assertThat(passes).as("3rd-and-1 should run heavily").isLessThan(SAMPLES / 2);
  }

  @Test
  void neutralCoachOn3rdAndLong_dominantlyPasses() {
    var state = state(3, 12, 50, 1, 600);
    var passes = countPasses(state, neutralCoach(), 2L);

    assertThat(passes).as("3rd-and-long should pass heavily").isGreaterThan((int) (SAMPLES * 0.85));
  }

  @Test
  void passHeaviness_monotonicallyIncreasesPassRate() {
    var state = state(1, 10, 50, 1, 600);
    var runHeavy = countPasses(state, withPassHeaviness(5), 3L);
    var passHeavy = countPasses(state, withPassHeaviness(95), 3L);

    assertThat(passHeavy).isGreaterThan(runHeavy + SAMPLES / 20);
  }

  @Test
  void passHeaviness_cannotOverride3rdAnd1Dominance() {
    var state = state(3, 1, 50, 1, 600);
    var passes = countPasses(state, withPassHeaviness(100), 4L);

    // Pass-happy coach still runs more often than not on 3rd-and-1 — situation dominates.
    assertThat(passes).as("situation still dominates personality").isLessThan(SAMPLES * 3 / 4);
  }

  @Test
  void offenseGettingSackedFrequently_increasesScreenShare() {
    var emptyState = state(1, 10, 50, 1, 600);
    var blitzedState = emptyState.withStats(homeBlitzed());

    var emptyScreens = countPassConcept(emptyState, neutralCoach(), PassConcept.SCREEN, 100L);
    var blitzedScreens = countPassConcept(blitzedState, neutralCoach(), PassConcept.SCREEN, 100L);

    assertThat(blitzedScreens).isGreaterThan(emptyScreens + SAMPLES / 100);
  }

  @Test
  void offenseRunningWell_increasesPlayActionShare() {
    var emptyState = state(1, 10, 50, 1, 600);
    var hotRunState = emptyState.withStats(homeRunHumming());

    var emptyPa = countPassConcept(emptyState, neutralCoach(), PassConcept.PLAY_ACTION, 200L);
    var hotPa = countPassConcept(hotRunState, neutralCoach(), PassConcept.PLAY_ACTION, 200L);

    assertThat(hotPa).isGreaterThan(emptyPa);
  }

  private int countPassConcept(GameState state, Coach coach, PassConcept concept, long seed) {
    var rng = new SplittableRandomSource(seed);
    var hits = 0;
    for (var i = 0; i < SAMPLES; i++) {
      var call = caller.call(state, coach, rng.split(i));
      if ("pass".equalsIgnoreCase(call.kind()) && call.passConcept() == concept) {
        hits++;
      }
    }
    return hits;
  }

  private static GameStats homeBlitzed() {
    var log =
        new TeamPlayLog(
            7,
            40,
            4,
            3,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            List.of(
                PlayKind.PASS_DROPBACK,
                PlayKind.PASS_DROPBACK,
                PlayKind.PASS_DROPBACK,
                PlayKind.PASS_DROPBACK,
                PlayKind.PASS_DROPBACK,
                PlayKind.PASS_DROPBACK,
                PlayKind.PASS_DROPBACK));
    return new GameStats(log, TeamPlayLog.empty());
  }

  private static GameStats homeRunHumming() {
    var log = new TeamPlayLog(0, 0, 0, 0, 0, 10, 70, 0, 0, 0, 0, List.of());
    return new GameStats(log, TeamPlayLog.empty());
  }

  private int countPasses(GameState state, Coach coach, long seed) {
    var rng = new SplittableRandomSource(seed);
    var passes = 0;
    for (var i = 0; i < SAMPLES; i++) {
      var call = caller.call(state, coach, rng.split(i));
      if ("pass".equalsIgnoreCase(call.kind())) {
        passes++;
      }
    }
    return passes;
  }

  private static Coach neutralCoach() {
    return new Coach(
        new CoachId(new UUID(7L, 7L)),
        "Neutral",
        CoachTendencies.average(),
        DefensiveCoachTendencies.average(),
        CoachQuality.average());
  }

  private static Coach withPassHeaviness(int value) {
    var offense = new CoachTendencies(value, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50);
    return new Coach(
        new CoachId(new UUID(7L, value)),
        "Test-" + value,
        offense,
        DefensiveCoachTendencies.average(),
        CoachQuality.average());
  }

  private static GameState state(int down, int dist, int yardLine, int quarter, int seconds) {
    return TestGameStates.of(
        down, dist, yardLine, quarter, seconds, 0, 0, app.zoneblitz.gamesimulator.event.Side.HOME);
  }
}
