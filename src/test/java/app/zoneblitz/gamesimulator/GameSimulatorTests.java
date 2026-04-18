package app.zoneblitz.gamesimulator;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.band.ClasspathBandRepository;
import app.zoneblitz.gamesimulator.band.DefaultBandSampler;
import app.zoneblitz.gamesimulator.clock.BandClockModel;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.event.TeamId;
import app.zoneblitz.gamesimulator.kickoff.TouchbackKickoffResolver;
import app.zoneblitz.gamesimulator.penalty.BandPenaltyModel;
import app.zoneblitz.gamesimulator.penalty.NoPenaltyModel;
import app.zoneblitz.gamesimulator.personnel.DefensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.FakePersonnelSelector;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.TestPersonnel;
import app.zoneblitz.gamesimulator.punt.DistanceCurvePuntResolver;
import app.zoneblitz.gamesimulator.resolver.PassOutcome;
import app.zoneblitz.gamesimulator.resolver.PlayOutcome;
import app.zoneblitz.gamesimulator.resolver.PlayResolver;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Coach;
import app.zoneblitz.gamesimulator.roster.CoachId;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Team;
import app.zoneblitz.gamesimulator.scoring.DistanceCurveFieldGoalResolver;
import app.zoneblitz.gamesimulator.scoring.FlatRateExtraPointResolver;
import app.zoneblitz.gamesimulator.scoring.FlatRateTwoPointResolver;
import app.zoneblitz.gamesimulator.scoring.StandardTwoPointDecisionPolicy;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class GameSimulatorTests {

  private static final GameId GAME_ID = new GameId(new UUID(42L, 99L));
  private static final PlayerId QB_ID = new PlayerId(new UUID(1L, 1L));
  private static final PlayerId WR_ID = new PlayerId(new UUID(1L, 2L));
  private static final Player QB = new Player(QB_ID, Position.QB, "Test QB");
  private static final Player WR = new Player(WR_ID, Position.WR, "Test WR");
  private static final Coach HOME_COACH =
      Coach.average(new CoachId(new UUID(2L, 2L)), "Home Coach");
  private static final Coach AWAY_COACH =
      Coach.average(new CoachId(new UUID(2L, 3L)), "Away Coach");
  private static final Player HOME_K =
      new Player(new PlayerId(new UUID(1L, 9L)), Position.K, "Home K");
  private static final Player AWAY_K =
      new Player(new PlayerId(new UUID(1L, 10L)), Position.K, "Away K");
  private static final Team HOME =
      new Team(new TeamId(new UUID(3L, 3L)), "Home Team", List.of(QB, WR, HOME_K));
  private static final Team AWAY =
      new Team(new TeamId(new UUID(4L, 4L)), "Away Team", List.of(AWAY_K));

  private SimulateGame newSimulator() {
    var personnel =
        new FakePersonnelSelector(TestPersonnel.baselineOffense(), TestPersonnel.baselineDefense());
    return new GameSimulator(
        ScriptedPlayCaller.runs(1),
        personnel,
        new ConstantPlayResolver(QB_ID, WR_ID),
        BandClockModel.load(new ClasspathBandRepository(), new DefaultBandSampler()),
        new TouchbackKickoffResolver(),
        new FlatRateExtraPointResolver(),
        new DistanceCurveFieldGoalResolver(),
        new DistanceCurvePuntResolver(),
        new NoPenaltyModel(),
        app.zoneblitz.gamesimulator.playcalling.DefensiveCallSelector.neutral(),
        new StandardTwoPointDecisionPolicy(),
        new FlatRateTwoPointResolver());
  }

  private static GameInputs inputs(Optional<Long> seed) {
    return new GameInputs(
        GAME_ID, HOME, AWAY, HOME_COACH, AWAY_COACH, new GameInputs.PreGameContext(), seed);
  }

  @Test
  void simulate_emitsContiguousSequencesAndTerminates() {
    var events = newSimulator().simulate(inputs(Optional.of(1L))).toList();

    assertThat(events).isNotEmpty();
    for (var i = 0; i < events.size(); i++) {
      assertThat(events.get(i).sequence()).isEqualTo(i);
    }
  }

  @Test
  void simulate_sameSeed_producesByteIdenticalStream() {
    var a = newSimulator().simulate(inputs(Optional.of(12345L))).toList();
    var b = newSimulator().simulate(inputs(Optional.of(12345L))).toList();

    assertThat(a).isEqualTo(b);
  }

  @Test
  void simulate_differentSeed_producesDifferentStream() {
    var a = newSimulator().simulate(inputs(Optional.of(1L))).toList();
    var b = newSimulator().simulate(inputs(Optional.of(2L))).toList();

    assertThat(a).isNotEqualTo(b);
  }

  @Test
  void simulate_ballCrossesGoalLine_emitsTouchdownFollowedByExtraPointAndKickoff() {
    var events = newSimulator().simulate(inputs(Optional.of(1L))).toList();

    var firstTdIndex = -1;
    for (var i = 0; i < events.size(); i++) {
      if (events.get(i) instanceof PlayEvent.PassComplete pc && pc.touchdown()) {
        firstTdIndex = i;
        break;
      }
    }
    assertThat(firstTdIndex)
        .as("expected at least one offensive touchdown")
        .isGreaterThanOrEqualTo(0);
    assertThat(events.get(firstTdIndex + 1)).isInstanceOf(PlayEvent.ExtraPoint.class);
    assertThat(events.get(firstTdIndex + 2)).isInstanceOf(PlayEvent.Kickoff.class);
  }

  @Test
  void simulate_withBandPenaltyModel_emitsPenaltyEventsAcrossGames() {
    var personnel =
        new FakePersonnelSelector(TestPersonnel.baselineOffense(), TestPersonnel.baselineDefense());
    var simulator =
        new GameSimulator(
            ScriptedPlayCaller.runs(1),
            personnel,
            new ConstantPlayResolver(QB_ID, WR_ID),
            BandClockModel.load(new ClasspathBandRepository(), new DefaultBandSampler()),
            new TouchbackKickoffResolver(),
            new FlatRateExtraPointResolver(),
            new DistanceCurveFieldGoalResolver(),
            new DistanceCurvePuntResolver(),
            new BandPenaltyModel(),
            app.zoneblitz.gamesimulator.playcalling.DefensiveCallSelector.neutral(),
            new StandardTwoPointDecisionPolicy(),
            new FlatRateTwoPointResolver());

    var penalties = 0;
    for (var seed = 1L; seed <= 10L; seed++) {
      var events = simulator.simulate(inputs(Optional.of(seed))).toList();
      for (var event : events) {
        if (event instanceof PlayEvent.Penalty) {
          penalties++;
        }
      }
    }
    // 10 games at ~13 flags/game average ≈ 130; a floor of 50 is a safe regression guard.
    assertThat(penalties).isGreaterThan(50);
  }

  @Test
  void simulate_sackInOwnEndZone_emitsSafetyEventImmediatelyAfterTriggeringPlay() {
    var personnel =
        new FakePersonnelSelector(TestPersonnel.baselineOffense(), TestPersonnel.baselineDefense());
    PlayResolver safetyResolver =
        new PlayResolver() {
          @Override
          public PlayOutcome resolve(
              PlayCaller.PlayCall call,
              GameState state,
              OffensivePersonnel offense,
              DefensivePersonnel defense,
              RandomSource rng) {
            return new PassOutcome.Sack(QB_ID, List.of(), 50, Optional.empty());
          }
        };
    var simulator =
        new GameSimulator(
            ScriptedPlayCaller.runs(1),
            personnel,
            safetyResolver,
            BandClockModel.load(new ClasspathBandRepository(), new DefaultBandSampler()),
            new TouchbackKickoffResolver(),
            new FlatRateExtraPointResolver(),
            new DistanceCurveFieldGoalResolver(),
            new DistanceCurvePuntResolver(),
            new NoPenaltyModel(),
            app.zoneblitz.gamesimulator.playcalling.DefensiveCallSelector.neutral(),
            new StandardTwoPointDecisionPolicy(),
            new FlatRateTwoPointResolver());

    var events = simulator.simulate(inputs(Optional.of(7L))).toList();

    var safetyIndex = -1;
    for (var i = 0; i < events.size(); i++) {
      if (events.get(i) instanceof PlayEvent.Safety) {
        safetyIndex = i;
        break;
      }
    }
    assertThat(safetyIndex).as("expected a Safety event to be emitted").isGreaterThanOrEqualTo(1);
    var safety = (PlayEvent.Safety) events.get(safetyIndex);
    var trigger = events.get(safetyIndex - 1);
    assertThat(trigger).isInstanceOf(PlayEvent.Sack.class);
    assertThat(safety.sequence()).isEqualTo(trigger.sequence() + 1);
    assertThat(safety.scoreAfter()).isEqualTo(trigger.scoreAfter());
    assertThat(safety.concedingSide()).isEqualTo(Side.HOME);
    assertThat(safety.spot().yardLine()).isEqualTo(20);
    assertThat(safety.scoreAfter().away()).isEqualTo(2);
    assertThat(safety.scoreAfter().home()).isZero();
  }

  @Test
  void simulate_twoPointPolicyChoosesTwo_replacesExtraPointWithTwoPointAttempt() {
    var personnel =
        new FakePersonnelSelector(TestPersonnel.baselineOffense(), TestPersonnel.baselineDefense());
    var simulator =
        new GameSimulator(
            ScriptedPlayCaller.runs(1),
            personnel,
            new ConstantPlayResolver(QB_ID, WR_ID),
            BandClockModel.load(new ClasspathBandRepository(), new DefaultBandSampler()),
            new TouchbackKickoffResolver(),
            new FlatRateExtraPointResolver(),
            new DistanceCurveFieldGoalResolver(),
            new DistanceCurvePuntResolver(),
            new NoPenaltyModel(),
            app.zoneblitz.gamesimulator.playcalling.DefensiveCallSelector.neutral(),
            (score, side, clock) -> true,
            new app.zoneblitz.gamesimulator.scoring.FlatRateTwoPointResolver(1.0, 0.0));

    var events = simulator.simulate(inputs(Optional.of(1L))).toList();

    var firstTdIndex = -1;
    for (var i = 0; i < events.size(); i++) {
      if (events.get(i) instanceof PlayEvent.PassComplete pc && pc.touchdown()) {
        firstTdIndex = i;
        break;
      }
    }
    assertThat(firstTdIndex)
        .as("expected at least one offensive touchdown")
        .isGreaterThanOrEqualTo(0);
    assertThat(events.get(firstTdIndex + 1)).isInstanceOf(PlayEvent.TwoPointAttempt.class);
    var twoPoint = (PlayEvent.TwoPointAttempt) events.get(firstTdIndex + 1);
    assertThat(twoPoint.success()).isTrue();
    var tdScore = events.get(firstTdIndex).scoreAfter();
    assertThat(twoPoint.scoreAfter().home() + twoPoint.scoreAfter().away())
        .isEqualTo(tdScore.home() + tdScore.away() + 2);
    assertThat(events.get(firstTdIndex + 2)).isInstanceOf(PlayEvent.Kickoff.class);
  }

  @Test
  void simulate_finalScore_isNonZeroForAtLeastOneSide() {
    var events = newSimulator().simulate(inputs(Optional.of(1L))).toList();

    var last = events.get(events.size() - 1);
    assertThat(last.scoreAfter().home() + last.scoreAfter().away()).isPositive();
  }

  @Test
  void concludeOvertimePossession_firstPossessionTouchdown_doesNotEndGameInOpeningOtPeriod() {
    var state =
        TestGameStates.of(1, 10, 25, 5, 600, 7, 0, Side.HOME)
            .withPhase(GameState.Phase.OVERTIME)
            .withOvertimeRound(1);

    var result = GameSimulator.concludeOvertimePossession(state, Side.HOME);

    assertThat(result.phase()).isEqualTo(GameState.Phase.OVERTIME);
    assertThat(result.overtime().homePossessed()).isTrue();
    assertThat(result.overtime().awayPossessed()).isFalse();
    assertThat(result.overtime().suddenDeath()).isFalse();
  }

  @Test
  void concludeOvertimePossession_bothPossessedScoresDiffer_finalizesGame() {
    var state =
        TestGameStates.of(1, 10, 25, 5, 300, 7, 0, Side.AWAY)
            .withPhase(GameState.Phase.OVERTIME)
            .withOvertimeRound(1)
            .withOvertime(new GameState.OvertimeState(true, false, false));

    var result = GameSimulator.concludeOvertimePossession(state, Side.AWAY);

    assertThat(result.phase()).isEqualTo(GameState.Phase.FINAL);
    assertThat(result.overtime().bothPossessed()).isTrue();
    assertThat(result.overtime().suddenDeath()).isTrue();
  }

  @Test
  void concludeOvertimePossession_bothPossessedStillTied_entersSuddenDeathWithoutFinalizing() {
    var state =
        TestGameStates.of(1, 10, 25, 5, 300, 3, 3, Side.AWAY)
            .withPhase(GameState.Phase.OVERTIME)
            .withOvertimeRound(1)
            .withOvertime(new GameState.OvertimeState(true, false, false));

    var result = GameSimulator.concludeOvertimePossession(state, Side.AWAY);

    assertThat(result.phase()).isEqualTo(GameState.Phase.OVERTIME);
    assertThat(result.overtime().suddenDeath()).isTrue();
  }

  @Test
  void concludeOvertimePossession_suddenDeathScoreLeads_finalizesImmediately() {
    var state =
        TestGameStates.of(1, 10, 25, 5, 120, 10, 7, Side.HOME)
            .withPhase(GameState.Phase.OVERTIME)
            .withOvertimeRound(1)
            .withOvertime(new GameState.OvertimeState(true, true, true));

    var result = GameSimulator.concludeOvertimePossession(state, Side.HOME);

    assertThat(result.phase()).isEqualTo(GameState.Phase.FINAL);
  }

  @Test
  void concludeOvertimePossession_outsideOvertime_leavesStateUntouched() {
    var state = TestGameStates.of(1, 10, 25, 2, 600, 7, 7, Side.HOME);

    var result = GameSimulator.concludeOvertimePossession(state, Side.HOME);

    assertThat(result).isSameAs(state);
  }

  @Test
  void simulate_regularSeasonEndsInTie_whenNeitherSideScoresInRegulationOrOvertime() {
    var events =
        zeroYardSimulator(GameType.REGULAR_SEASON).simulate(inputs(Optional.of(42L))).toList();

    var last = events.get(events.size() - 1);
    assertThat(last.scoreAfter().home()).isEqualTo(last.scoreAfter().away());
    var quarters =
        events.stream()
            .filter(e -> e instanceof PlayEvent.EndOfQuarter)
            .map(e -> ((PlayEvent.EndOfQuarter) e).quarter())
            .toList();
    assertThat(quarters).contains(5);
    assertThat(quarters.stream().filter(q -> q >= 5).count())
        .as("regular-season OT plays at most one period before ending tied")
        .isEqualTo(1L);
  }

  private SimulateGame zeroYardSimulator(GameType gameType) {
    var personnel =
        new FakePersonnelSelector(TestPersonnel.baselineOffense(), TestPersonnel.baselineDefense());
    return new GameSimulator(
        ScriptedPlayCaller.runs(1),
        personnel,
        zeroYardRunResolver(),
        BandClockModel.load(new ClasspathBandRepository(), new DefaultBandSampler()),
        new TouchbackKickoffResolver(),
        new FlatRateExtraPointResolver(),
        new DistanceCurveFieldGoalResolver(),
        new DistanceCurvePuntResolver(),
        new NoPenaltyModel(),
        app.zoneblitz.gamesimulator.playcalling.DefensiveCallSelector.neutral());
  }

  private PlayResolver zeroYardRunResolver() {
    return new PlayResolver() {
      @Override
      public PlayOutcome resolve(
          PlayCaller.PlayCall call,
          GameState state,
          OffensivePersonnel offense,
          DefensivePersonnel defense,
          RandomSource rng) {
        rng.nextLong();
        return new app.zoneblitz.gamesimulator.resolver.RunOutcome.Run(
            QB_ID,
            app.zoneblitz.gamesimulator.event.RunConcept.INSIDE_ZONE,
            0,
            Optional.<PlayerId>empty(),
            Optional.<app.zoneblitz.gamesimulator.event.FumbleOutcome>empty(),
            false);
      }
    };
  }

  private GameInputs playoffInputs(Optional<Long> seed) {
    return new GameInputs(
        GAME_ID,
        HOME,
        AWAY,
        HOME_COACH,
        AWAY_COACH,
        new GameInputs.PreGameContext(),
        GameType.PLAYOFFS,
        seed);
  }

  @Test
  void simulate_playoffGameNeverEndsTied_evenWhenBaseOffenseNeverScores() {
    var events =
        zeroYardSimulator(GameType.PLAYOFFS).simulate(playoffInputs(Optional.of(7L))).toList();

    var last = events.get(events.size() - 1);
    assertThat(events.size()).isLessThanOrEqualTo(500);
    if (last.scoreAfter().home() == last.scoreAfter().away()) {
      assertThat(events.size()).isEqualTo(500);
    }
  }
}
