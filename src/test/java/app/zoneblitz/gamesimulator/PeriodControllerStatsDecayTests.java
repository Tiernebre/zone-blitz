package app.zoneblitz.gamesimulator;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.adjustments.GameStats;
import app.zoneblitz.gamesimulator.adjustments.TeamPlayLog;
import app.zoneblitz.gamesimulator.clock.ClockModel;
import app.zoneblitz.gamesimulator.clock.Kick;
import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.event.TeamId;
import app.zoneblitz.gamesimulator.kickoff.KickoffResolver;
import app.zoneblitz.gamesimulator.resolver.PlayOutcome;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import app.zoneblitz.gamesimulator.roster.Coach;
import app.zoneblitz.gamesimulator.roster.CoachId;
import app.zoneblitz.gamesimulator.roster.Team;
import app.zoneblitz.gamesimulator.scoring.ExtraPointResolver;
import app.zoneblitz.gamesimulator.scoring.FlatRateExtraPointResolver;
import app.zoneblitz.gamesimulator.scoring.FlatRateTwoPointResolver;
import app.zoneblitz.gamesimulator.scoring.StandardTwoPointDecisionPolicy;
import app.zoneblitz.gamesimulator.scoring.TwoPointResolver;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class PeriodControllerStatsDecayTests {

  @Test
  void endOfQ1_decaysStatsByQuarterFactor() {
    var controller = controller();
    var state = stateAtEndOfQuarter(1).withStats(stats());

    var next = controller.endOfQuarter(events(), state, inputs(), Side.HOME, seq(), root(), 0L);

    assertThat(next.stats().home().passYards())
        .isEqualTo((int) Math.round(500 * PeriodController.QUARTER_DECAY_FACTOR));
  }

  @Test
  void endOfQ3_decaysStatsByQuarterFactor() {
    var controller = controller();
    var state = stateAtEndOfQuarter(3).withStats(stats());

    var next = controller.endOfQuarter(events(), state, inputs(), Side.HOME, seq(), root(), 0L);

    assertThat(next.stats().home().passYards())
        .isEqualTo((int) Math.round(500 * PeriodController.QUARTER_DECAY_FACTOR));
  }

  @Test
  void endOfQ4Untied_finalizesGameWithoutMutatingStats() {
    var controller = controller();
    var state =
        stateAtEndOfQuarter(4)
            .withStats(stats())
            .withScore(new app.zoneblitz.gamesimulator.event.Score(14, 7));

    var next = controller.endOfQuarter(events(), state, inputs(), Side.HOME, seq(), root(), 0L);

    assertThat(next.phase()).isEqualTo(GameState.Phase.FINAL);
    assertThat(next.stats().home().passYards()).isEqualTo(500);
  }

  // ----- helpers -----

  private static PeriodController controller() {
    var sequencer =
        new ScoringSequencer(
            zeroClock(),
            stubKickoff(),
            new FlatRateExtraPointResolver(),
            new FlatRateTwoPointResolver(),
            new StandardTwoPointDecisionPolicy());
    return new PeriodController(sequencer);
  }

  private static GameStats stats() {
    var hot = new TeamPlayLog(10, 500, 6, 0, 0, 0, 0, 0, 0, 0, 0, List.of());
    return new GameStats(hot, TeamPlayLog.empty());
  }

  private static GameState stateAtEndOfQuarter(int quarter) {
    return GameState.initial().withClock(new GameClock(quarter, 0));
  }

  private static GameInputs inputs() {
    var team = new Team(new TeamId(new UUID(1L, 1L)), "TST", List.of());
    var coach = Coach.average(new CoachId(new UUID(2L, 2L)), "Test");
    return new GameInputs(
        new GameId(new UUID(7L, 7L)),
        team,
        team,
        coach,
        coach,
        new GameInputs.PreGameContext(
            app.zoneblitz.gamesimulator.environment.HomeFieldAdvantage.leagueAverage(),
            app.zoneblitz.gamesimulator.environment.Weather.indoor(),
            app.zoneblitz.gamesimulator.environment.Surface.GRASS,
            app.zoneblitz.gamesimulator.environment.Roof.DOME),
        GameType.REGULAR_SEASON,
        Optional.<Long>empty());
  }

  private static List<PlayEvent> events() {
    return new ArrayList<>();
  }

  private static int[] seq() {
    return new int[] {0};
  }

  private static SplittableRandomSource root() {
    return new SplittableRandomSource(0L);
  }

  private static ClockModel zeroClock() {
    return new ClockModel() {
      @Override
      public int secondsConsumed(PlayOutcome outcome, GameState state, RandomSource rng) {
        return 0;
      }

      @Override
      public int secondsConsumedForKick(Kick kick, GameState preSnap, RandomSource rng) {
        return 0;
      }
    };
  }

  private static KickoffResolver stubKickoff() {
    return (kicking, receiving, receivingSide, gameId, sequence, clock, score, rng) -> {
      throw new UnsupportedOperationException(
          "stubKickoff should not be invoked by Q1/Q3/Q4-untied paths");
    };
  }

  // unused helpers retained to keep the resolver constructor surface explicit
  @SuppressWarnings("unused")
  private static ExtraPointResolver patStub() {
    return new FlatRateExtraPointResolver();
  }

  @SuppressWarnings("unused")
  private static TwoPointResolver twoPointStub() {
    return new FlatRateTwoPointResolver();
  }
}
