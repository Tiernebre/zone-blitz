package app.zoneblitz.gamesimulator;

import app.zoneblitz.gamesimulator.adjustments.GameStatsAccumulator;
import app.zoneblitz.gamesimulator.adjustments.RollingGameStatsAccumulator;
import app.zoneblitz.gamesimulator.clock.ClockModel;
import app.zoneblitz.gamesimulator.clockmgmt.EndOfHalfDecider;
import app.zoneblitz.gamesimulator.clockmgmt.TendencyEndOfHalfDecider;
import app.zoneblitz.gamesimulator.clockmgmt.TendencyTimeoutDecider;
import app.zoneblitz.gamesimulator.clockmgmt.TimeoutDecider;
import app.zoneblitz.gamesimulator.environment.EnvironmentalModifiers;
import app.zoneblitz.gamesimulator.environment.HomeFieldModel;
import app.zoneblitz.gamesimulator.event.FieldPosition;
import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.fatigue.FatigueModel;
import app.zoneblitz.gamesimulator.fatigue.PositionalFatigueModel;
import app.zoneblitz.gamesimulator.fourthdown.AggressionFourthDownPolicy;
import app.zoneblitz.gamesimulator.fourthdown.FourthDownPolicy;
import app.zoneblitz.gamesimulator.injury.InjuryModel;
import app.zoneblitz.gamesimulator.kickoff.KickoffResolver;
import app.zoneblitz.gamesimulator.penalty.PenaltyModel;
import app.zoneblitz.gamesimulator.personnel.PersonnelSelector;
import app.zoneblitz.gamesimulator.playcalling.DefensiveCallSelector;
import app.zoneblitz.gamesimulator.playcalling.PlayCaller;
import app.zoneblitz.gamesimulator.punt.EnvironmentalPuntResolver;
import app.zoneblitz.gamesimulator.punt.PuntResolver;
import app.zoneblitz.gamesimulator.resolver.PlayResolver;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import app.zoneblitz.gamesimulator.scoring.EnvironmentalFieldGoalResolver;
import app.zoneblitz.gamesimulator.scoring.ExtraPointResolver;
import app.zoneblitz.gamesimulator.scoring.FieldGoalResolver;
import app.zoneblitz.gamesimulator.scoring.TwoPointDecisionPolicy;
import app.zoneblitz.gamesimulator.scoring.TwoPointResolver;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Stream;

/**
 * Walking-skeleton engine. Advances {@link GameState} snap-over-snap: resolves one snap via the
 * supplied {@link PlayResolver}, ticks the game clock using the supplied {@link ClockModel}, and
 * emits period boundaries via {@link PeriodController}. Halftime flips possession per the coin-toss
 * rule; an end-of-regulation tie triggers a single overtime period; NFL-compliant OT rules are
 * deferred.
 *
 * <p>Scoring is derived here, not in resolvers. {@link SnapAdvance#derive} clamps raw resolver
 * yardage against the goal lines and surfaces touchdowns, safeties, and turnovers; this class then
 * dispatches the scoring sequence (TD → PAT → kickoff, FG → kickoff, safety → free-kick-spot)
 * through {@link ScoringSequencer} / {@link SpecialTeams} / {@link ScoringAftermath} and threads
 * possession / spot / down-and-distance forward.
 */
final class GameSimulator implements SimulateGame {

  private static final int REGULATION_QUARTER_SECONDS = 15 * 60;
  private static final int HARD_SNAP_CAP = 500;
  private static final long CLOCK_SPLIT_KEY = 0x3333_eeffL;
  private static final long PENALTY_PRE_KEY = 0xFD44_4444L;
  private static final long PENALTY_LIVE_KEY = 0xFE33_3333L;
  private static final long PENALTY_POST_KEY = 0xFF22_2222L;
  private static final long HOME_FIELD_KEY = 0xFEED_FACEL;
  private static final long END_OF_HALF_SPLIT_KEY = 0xE0FA_1F00L;
  private static final long DEFENSIVE_CALL_KEY = 0xDEFE_7155L;
  private static final long FOURTH_DOWN_SPLIT_KEY = 0x4D04_4D04L;

  private final PlayCaller caller;
  private final PersonnelSelector personnel;
  private final PlayResolver resolver;
  private final ClockModel clockModel;
  private final FieldGoalResolver fieldGoalResolver;
  private final PuntResolver puntResolver;
  private final PenaltyModel penaltyModel;
  private final DefensiveCallSelector defensiveCallSelector;
  private final HomeFieldModel homeFieldModel;
  private final EndOfHalfDecider endOfHalfDecider;
  private final FatigueModel fatigueModel;
  private final ScoringSequencer scoring;
  private final SpecialTeams specialTeams;
  private final PeriodController period;
  private final TimeoutController timeouts;
  private final ScoringAftermath aftermath;
  private final InjuryEmitter injuries;
  private final FourthDownPolicy fourthDownPolicy = new AggressionFourthDownPolicy();
  private final GameStatsAccumulator statsAccumulator = new RollingGameStatsAccumulator();

  GameSimulator(
      PlayCaller caller,
      PersonnelSelector personnel,
      PlayResolver resolver,
      ClockModel clockModel,
      KickoffResolver kickoffResolver,
      ExtraPointResolver extraPointResolver,
      FieldGoalResolver fieldGoalResolver,
      PuntResolver puntResolver,
      PenaltyModel penaltyModel,
      DefensiveCallSelector defensiveCallSelector,
      TwoPointDecisionPolicy twoPointPolicy,
      TwoPointResolver twoPointResolver) {
    this(
        caller,
        personnel,
        resolver,
        clockModel,
        kickoffResolver,
        extraPointResolver,
        fieldGoalResolver,
        puntResolver,
        penaltyModel,
        defensiveCallSelector,
        twoPointPolicy,
        twoPointResolver,
        HomeFieldModel.neutral(),
        new TendencyTimeoutDecider(),
        new TendencyEndOfHalfDecider(),
        new PositionalFatigueModel(),
        (outcome, off, def, side, surface, rng) -> List.of());
  }

  GameSimulator(
      PlayCaller caller,
      PersonnelSelector personnel,
      PlayResolver resolver,
      ClockModel clockModel,
      KickoffResolver kickoffResolver,
      ExtraPointResolver extraPointResolver,
      FieldGoalResolver fieldGoalResolver,
      PuntResolver puntResolver,
      PenaltyModel penaltyModel,
      DefensiveCallSelector defensiveCallSelector,
      TwoPointDecisionPolicy twoPointPolicy,
      TwoPointResolver twoPointResolver,
      HomeFieldModel homeFieldModel,
      TimeoutDecider timeoutDecider) {
    this(
        caller,
        personnel,
        resolver,
        clockModel,
        kickoffResolver,
        extraPointResolver,
        fieldGoalResolver,
        puntResolver,
        penaltyModel,
        defensiveCallSelector,
        twoPointPolicy,
        twoPointResolver,
        homeFieldModel,
        timeoutDecider,
        new TendencyEndOfHalfDecider(),
        new PositionalFatigueModel(),
        (outcome, off, def, side, surface, rng) -> List.of());
  }

  GameSimulator(
      PlayCaller caller,
      PersonnelSelector personnel,
      PlayResolver resolver,
      ClockModel clockModel,
      KickoffResolver kickoffResolver,
      ExtraPointResolver extraPointResolver,
      FieldGoalResolver fieldGoalResolver,
      PuntResolver puntResolver,
      PenaltyModel penaltyModel,
      DefensiveCallSelector defensiveCallSelector,
      TwoPointDecisionPolicy twoPointPolicy,
      TwoPointResolver twoPointResolver,
      HomeFieldModel homeFieldModel,
      TimeoutDecider timeoutDecider,
      EndOfHalfDecider endOfHalfDecider) {
    this(
        caller,
        personnel,
        resolver,
        clockModel,
        kickoffResolver,
        extraPointResolver,
        fieldGoalResolver,
        puntResolver,
        penaltyModel,
        defensiveCallSelector,
        twoPointPolicy,
        twoPointResolver,
        homeFieldModel,
        timeoutDecider,
        endOfHalfDecider,
        new PositionalFatigueModel(),
        (outcome, off, def, side, surface, rng) -> List.of());
  }

  GameSimulator(
      PlayCaller caller,
      PersonnelSelector personnel,
      PlayResolver resolver,
      ClockModel clockModel,
      KickoffResolver kickoffResolver,
      ExtraPointResolver extraPointResolver,
      FieldGoalResolver fieldGoalResolver,
      PuntResolver puntResolver,
      PenaltyModel penaltyModel,
      DefensiveCallSelector defensiveCallSelector,
      TwoPointDecisionPolicy twoPointPolicy,
      TwoPointResolver twoPointResolver,
      HomeFieldModel homeFieldModel,
      TimeoutDecider timeoutDecider,
      EndOfHalfDecider endOfHalfDecider,
      FatigueModel fatigueModel) {
    this(
        caller,
        personnel,
        resolver,
        clockModel,
        kickoffResolver,
        extraPointResolver,
        fieldGoalResolver,
        puntResolver,
        penaltyModel,
        defensiveCallSelector,
        twoPointPolicy,
        twoPointResolver,
        homeFieldModel,
        timeoutDecider,
        endOfHalfDecider,
        fatigueModel,
        (outcome, off, def, side, surface, rng) -> List.of());
  }

  GameSimulator(
      PlayCaller caller,
      PersonnelSelector personnel,
      PlayResolver resolver,
      ClockModel clockModel,
      KickoffResolver kickoffResolver,
      ExtraPointResolver extraPointResolver,
      FieldGoalResolver fieldGoalResolver,
      PuntResolver puntResolver,
      PenaltyModel penaltyModel,
      DefensiveCallSelector defensiveCallSelector,
      TwoPointDecisionPolicy twoPointPolicy,
      TwoPointResolver twoPointResolver,
      HomeFieldModel homeFieldModel,
      TimeoutDecider timeoutDecider,
      EndOfHalfDecider endOfHalfDecider,
      FatigueModel fatigueModel,
      InjuryModel injuryModel) {
    this.caller = Objects.requireNonNull(caller, "caller");
    this.personnel = Objects.requireNonNull(personnel, "personnel");
    this.resolver = Objects.requireNonNull(resolver, "resolver");
    this.clockModel = Objects.requireNonNull(clockModel, "clockModel");
    this.fieldGoalResolver = Objects.requireNonNull(fieldGoalResolver, "fieldGoalResolver");
    this.puntResolver = Objects.requireNonNull(puntResolver, "puntResolver");
    this.penaltyModel = Objects.requireNonNull(penaltyModel, "penaltyModel");
    this.defensiveCallSelector =
        Objects.requireNonNull(defensiveCallSelector, "defensiveCallSelector");
    this.homeFieldModel = Objects.requireNonNull(homeFieldModel, "homeFieldModel");
    this.endOfHalfDecider = Objects.requireNonNull(endOfHalfDecider, "endOfHalfDecider");
    this.fatigueModel = Objects.requireNonNull(fatigueModel, "fatigueModel");
    this.scoring =
        new ScoringSequencer(
            clockModel, kickoffResolver, extraPointResolver, twoPointResolver, twoPointPolicy);
    this.specialTeams = new SpecialTeams(scoring);
    this.period = new PeriodController(scoring);
    this.timeouts = new TimeoutController(timeoutDecider);
    this.aftermath = new ScoringAftermath(scoring);
    this.injuries = new InjuryEmitter(injuryModel);
  }

  @Override
  public Stream<PlayEvent> simulate(GameInputs inputs) {
    return runFullGame(inputs).events.stream();
  }

  @Override
  public GameSummary summarize(GameInputs inputs) {
    var run = runFullGame(inputs);
    return new GameSummary(run.events, run.terminalState.fatigueSnapCounts());
  }

  private record GameRun(List<PlayEvent> events, GameState terminalState) {}

  private GameRun runFullGame(GameInputs inputs) {
    Objects.requireNonNull(inputs, "inputs");
    var seed = inputs.seed().orElse(0L);
    var root = new SplittableRandomSource(seed);
    var gameKey = (long) inputs.gameId().value().hashCode();

    var modifiers = EnvironmentalModifiers.from(inputs.preGameContext());
    var gameFieldGoal = new EnvironmentalFieldGoalResolver(fieldGoalResolver, modifiers);
    var gamePunt = new EnvironmentalPuntResolver(puntResolver, modifiers);

    var openingReceiver = Side.HOME;
    var events = new ArrayList<PlayEvent>();
    var seq = new int[] {0};

    var state = GameState.initial().withClock(new GameClock(1, REGULATION_QUARTER_SECONDS));

    state = scoring.emitKickoff(events, state, inputs, openingReceiver, seq, root.split(gameKey));

    while (state.phase() != GameState.Phase.FINAL && seq[0] < HARD_SNAP_CAP) {
      if (state.clock().secondsRemaining() <= 0) {
        state = period.endOfQuarter(events, state, inputs, openingReceiver, seq, root, gameKey);
        continue;
      }
      state = timeouts.maybeCallTimeout(events, state, inputs, seq, root, gameKey);
      state = runSnap(events, state, inputs, seq, root, gameKey, gameFieldGoal, gamePunt);
    }
    return new GameRun(events, state);
  }

  private GameState runSnap(
      List<PlayEvent> out,
      GameState state,
      GameInputs inputs,
      int[] seq,
      SplittableRandomSource root,
      long gameKey,
      FieldGoalResolver fieldGoal,
      PuntResolver punt) {
    var endOfHalfRng = root.split(gameKey ^ END_OF_HALF_SPLIT_KEY ^ ((long) seq[0] << 16));
    var offenseCoachForDecision =
        state.possession() == Side.HOME ? inputs.homeCoach() : inputs.awayCoach();
    var endOfHalf = endOfHalfDecider.decide(state, offenseCoachForDecision, endOfHalfRng);
    if (endOfHalf.isPresent()) {
      return switch (endOfHalf.get()) {
        case KNEEL -> EndOfHalfPlays.runKneel(out, state, inputs, seq, root, gameKey);
        case SPIKE -> EndOfHalfPlays.runSpike(out, state, inputs, seq, root, gameKey);
      };
    }
    if (state.downAndDistance().down() == 4) {
      var policyRng = root.split(gameKey ^ FOURTH_DOWN_SPLIT_KEY ^ ((long) seq[0] << 8));
      var decision = fourthDownPolicy.decide(state, offenseCoachForDecision, policyRng);
      switch (decision) {
        case ATTEMPT_FIELD_GOAL -> {
          return specialTeams.runFieldGoal(out, state, inputs, seq, root, gameKey, fieldGoal);
        }
        case PUNT -> {
          return specialTeams.runPunt(out, state, inputs, seq, root, gameKey, punt);
        }
        case GO_FOR_IT -> {
          // Fall through to normal scrimmage snap — DownProgression handles turnover on downs.
        }
      }
    }

    var snapRng = root.split(gameKey ^ ((long) seq[0] << 32));
    var offenseSide = state.possession();
    var defenseSide = offenseSide == Side.HOME ? Side.AWAY : Side.HOME;
    var offense = offenseSide == Side.HOME ? inputs.home() : inputs.away();
    var defense = defenseSide == Side.HOME ? inputs.home() : inputs.away();
    var offenseCoach = offenseSide == Side.HOME ? inputs.homeCoach() : inputs.awayCoach();
    var defenseCoach = defenseSide == Side.HOME ? inputs.homeCoach() : inputs.awayCoach();
    var offenseProfile = app.zoneblitz.gamesimulator.roster.RosterProfile.of(offense);
    var defenseProfile = app.zoneblitz.gamesimulator.roster.RosterProfile.of(defense);
    var call = caller.call(state, offenseCoach, offenseProfile, snapRng);
    // Defensive call is selected pre-snap for every scrimmage play. It is not yet fed into the
    // pass/run resolvers' matchup shifts — that wiring is the phase-5 follow-up. Selecting it
    // here keeps the seam exercised so calibration tests can assert league-average blitz / shell
    // distributions and the DC's tendencies have an observable effect.
    var defensiveCall =
        defensiveCallSelector.select(
            state,
            call.formation(),
            defenseCoach.defense(),
            defenseProfile,
            snapRng.split(DEFENSIVE_CALL_KEY));
    Objects.requireNonNull(defensiveCall, "defensiveCall");
    var offPersonnelRaw = personnel.selectOffense(call, state, offense);
    var offPersonnel =
        fatigueModel.rotateOffense(offPersonnelRaw, offense, state.fatigueSnapCounts());
    var defPersonnelRaw = personnel.selectDefense(call, offPersonnel, state, defense);
    var defPersonnel =
        fatigueModel.rotateDefense(
            defPersonnelRaw, defense, state.fatigueSnapCounts(), defenseCoach.defense());

    var homeFieldDraw =
        homeFieldModel.drawRoadPreSnapPenalty(
            offenseSide,
            offPersonnel,
            inputs.preGameContext().homeFieldAdvantage(),
            snapRng.split(HOME_FIELD_KEY));
    if (homeFieldDraw.isPresent()) {
      return PenaltyEmitter.emitPreSnap(
          out, state, homeFieldDraw.get(), seq, inputs.gameId(), offenseSide);
    }

    var preSnapPenalty =
        penaltyModel.preSnap(
            state,
            offPersonnel,
            defPersonnel,
            offenseCoach,
            defenseCoach,
            snapRng.split(PENALTY_PRE_KEY));
    if (preSnapPenalty.isPresent()) {
      return PenaltyEmitter.emitPreSnap(
          out, state, preSnapPenalty.get(), seq, inputs.gameId(), offenseSide);
    }

    var sequence = seq[0]++;
    var outcome = resolver.resolve(call, state, offPersonnel, defPersonnel, snapRng);

    var secondsOff = clockModel.secondsConsumed(outcome, state, snapRng.split(CLOCK_SPLIT_KEY));
    var clockAfter =
        new GameClock(state.clock().quarter(), state.clock().secondsRemaining() - secondsOff);

    var preYL = state.spot().yardLine();
    var advance = SnapAdvance.derive(outcome, preYL);
    var scoreAfter =
        PlayEventFactory.scoreAfterPlay(state.score(), offenseSide, defenseSide, advance);

    var event =
        PlayEventFactory.toEvent(
            outcome, state, clockAfter, scoreAfter, advance, sequence, inputs.gameId());

    var isScoringOrTurnover =
        advance.touchdown()
            || advance.defensiveTouchdown()
            || advance.safety()
            || advance.turnover() != SnapAdvance.Turnover.NONE;

    if (!isScoringOrTurnover) {
      var liveBall =
          penaltyModel.duringPlay(
              call, outcome, state, offPersonnel, defPersonnel, snapRng.split(PENALTY_LIVE_KEY));
      if (liveBall.isPresent()
          && PenaltyEmitter.shouldAccept(liveBall.get(), advance, offenseSide)) {
        return PenaltyEmitter.emitLiveBall(
            out, state, event, liveBall.get(), clockAfter, sequence, inputs.gameId(), offenseSide);
      }
    }

    out.add(event);
    state =
        state.withStats(
            statsAccumulator.apply(state.stats(), event, offenseSide, Optional.of(call)));
    var participants =
        new ArrayList<PlayerId>(offPersonnel.players().size() + defPersonnel.players().size());
    offPersonnel.players().forEach(p -> participants.add(p.id()));
    defPersonnel.players().forEach(p -> participants.add(p.id()));
    state = state.withSnapsAccumulated(List.copyOf(participants));

    state =
        injuries.emit(
            out,
            state,
            outcome,
            offPersonnel,
            defPersonnel,
            offenseSide,
            inputs,
            event,
            clockAfter,
            seq,
            snapRng);

    var ctx = new ScoringAftermath.Context(scoreAfter, clockAfter, offenseSide, defenseSide);
    if (advance.touchdown()) {
      return aftermath.afterTouchdown(out, state, inputs, ctx, sequence, seq, root, gameKey);
    }
    if (advance.defensiveTouchdown()) {
      return aftermath.afterDefensiveTouchdown(
          out, state, inputs, ctx, sequence, seq, root, gameKey);
    }
    if (advance.safety()) {
      return aftermath.afterSafety(out, state, inputs, ctx, sequence, seq, root, gameKey);
    }
    if (advance.turnover() != SnapAdvance.Turnover.NONE) {
      return aftermath.afterLiveBallTurnover(state, ctx, advance.endYardLine());
    }

    var newDd = DownProgression.advance(state.downAndDistance(), advance, preYL);
    if (newDd == null) {
      return aftermath.afterTurnoverOnDowns(state, ctx, advance.endYardLine());
    }
    state =
        state.afterScrimmage(event, clockAfter, new FieldPosition(advance.endYardLine()), newDd);

    var postPlay =
        penaltyModel.postPlay(
            offenseSide, offPersonnel, defPersonnel, snapRng.split(PENALTY_POST_KEY));
    if (postPlay.isPresent()) {
      state =
          PenaltyEmitter.emitPostPlay(
              out, state, postPlay.get(), seq, inputs.gameId(), offenseSide);
    }
    return state;
  }
}
