package app.zoneblitz.gamesimulator;

import app.zoneblitz.gamesimulator.clock.ClockModel;
import app.zoneblitz.gamesimulator.clock.Kick;
import app.zoneblitz.gamesimulator.event.DownAndDistance;
import app.zoneblitz.gamesimulator.event.FieldPosition;
import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.PlayId;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.kickoff.KickoffResolver;
import app.zoneblitz.gamesimulator.penalty.PenaltyDraw;
import app.zoneblitz.gamesimulator.penalty.PenaltyEnforcement;
import app.zoneblitz.gamesimulator.penalty.PenaltyEnforcer;
import app.zoneblitz.gamesimulator.penalty.PenaltyModel;
import app.zoneblitz.gamesimulator.personnel.PersonnelSelector;
import app.zoneblitz.gamesimulator.playcalling.DefensiveCallSelector;
import app.zoneblitz.gamesimulator.punt.PuntResolver;
import app.zoneblitz.gamesimulator.resolver.PassOutcome;
import app.zoneblitz.gamesimulator.resolver.PlayOutcome;
import app.zoneblitz.gamesimulator.resolver.PlayResolver;
import app.zoneblitz.gamesimulator.resolver.RunOutcome;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import app.zoneblitz.gamesimulator.scoring.ExtraPointResolver;
import app.zoneblitz.gamesimulator.scoring.FieldGoalResolver;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;

/**
 * Walking-skeleton engine. Advances {@link GameState} snap-over-snap: resolves one snap via the
 * supplied {@link PlayResolver}, ticks the game clock using the supplied {@link ClockModel}, and
 * emits {@link PlayEvent.EndOfQuarter} / {@link PlayEvent.Kickoff} at period boundaries. Halftime
 * flips possession per the coin-toss rule; an end-of-regulation tie triggers a single overtime
 * period; NFL-compliant OT rules are deferred.
 *
 * <p>Scoring is derived here, not in resolvers. {@link SnapAdvance#derive} clamps raw resolver
 * yardage against the goal lines and surfaces touchdowns, safeties, and turnovers; this class then
 * emits the scoring sequence (TD → PAT → kickoff, FG → kickoff, safety → free-kick-spot) and
 * threads possession/spot/down-and-distance forward.
 */
final class GameSimulator implements SimulateGame {

  private static final int REGULATION_QUARTER_SECONDS = 15 * 60;
  private static final int OVERTIME_PERIOD_SECONDS = 10 * 60;
  private static final int HARD_SNAP_CAP = 500;
  private static final long CLOCK_SPLIT_KEY = 0x3333_eeffL;
  private static final long PAT_SPLIT_KEY = 0xFA77_7777L;
  private static final long FG_SPLIT_KEY = 0xFB66_6666L;
  private static final long PUNT_SPLIT_KEY = 0xFC55_5555L;
  private static final long PENALTY_PRE_KEY = 0xFD44_4444L;
  private static final long PENALTY_LIVE_KEY = 0xFE33_3333L;
  private static final long PENALTY_POST_KEY = 0xFF22_2222L;

  /**
   * Inside this many yards of the opposing goal line a 4th down triggers a field-goal attempt.
   * Value 63 corresponds to the opponent's 37-yard line, i.e. a kick of {@code (100 - 63) + 17 =
   * 54} yards — the baseline edge of reasonable make probability.
   */
  private static final int FIELD_GOAL_MIN_YARD_LINE = 63;

  /**
   * After a safety, the conceding team free-kicks from their own 20 and we model it as a direct
   * spot of the ball for the scoring team at their own 20. Simplification flagged as a follow-up.
   */
  private static final int SAFETY_FREE_KICK_SPOT = 20;

  private final PlayCaller caller;
  private final PersonnelSelector personnel;
  private final PlayResolver resolver;
  private final ClockModel clockModel;
  private final KickoffResolver kickoffResolver;
  private final ExtraPointResolver extraPointResolver;
  private final FieldGoalResolver fieldGoalResolver;
  private final PuntResolver puntResolver;
  private final PenaltyModel penaltyModel;
  private final DefensiveCallSelector defensiveCallSelector;

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
      DefensiveCallSelector defensiveCallSelector) {
    this.caller = Objects.requireNonNull(caller, "caller");
    this.personnel = Objects.requireNonNull(personnel, "personnel");
    this.resolver = Objects.requireNonNull(resolver, "resolver");
    this.clockModel = Objects.requireNonNull(clockModel, "clockModel");
    this.kickoffResolver = Objects.requireNonNull(kickoffResolver, "kickoffResolver");
    this.extraPointResolver = Objects.requireNonNull(extraPointResolver, "extraPointResolver");
    this.fieldGoalResolver = Objects.requireNonNull(fieldGoalResolver, "fieldGoalResolver");
    this.puntResolver = Objects.requireNonNull(puntResolver, "puntResolver");
    this.penaltyModel = Objects.requireNonNull(penaltyModel, "penaltyModel");
    this.defensiveCallSelector =
        Objects.requireNonNull(defensiveCallSelector, "defensiveCallSelector");
  }

  @Override
  public Stream<PlayEvent> simulate(GameInputs inputs) {
    Objects.requireNonNull(inputs, "inputs");
    var seed = inputs.seed().orElse(0L);
    var root = new SplittableRandomSource(seed);
    var gameKey = (long) inputs.gameId().value().hashCode();

    var openingReceiver = Side.HOME;
    var events = new ArrayList<PlayEvent>();
    var seq = new int[] {0};

    var state = GameState.initial().withClock(new GameClock(1, REGULATION_QUARTER_SECONDS));

    state = emitKickoff(events, state, inputs, openingReceiver, seq, root.split(gameKey));

    while (state.phase() != GameState.Phase.FINAL && seq[0] < HARD_SNAP_CAP) {
      if (state.clock().secondsRemaining() <= 0) {
        state = endOfQuarter(events, state, inputs, openingReceiver, seq, root, gameKey);
        continue;
      }
      state = runSnap(events, state, inputs, seq, root, gameKey);
    }
    return events.stream();
  }

  private GameState runSnap(
      List<PlayEvent> out,
      GameState state,
      GameInputs inputs,
      int[] seq,
      SplittableRandomSource root,
      long gameKey) {
    if (shouldAttemptFieldGoal(state)) {
      return runFieldGoal(out, state, inputs, seq, root, gameKey);
    }
    if (shouldPunt(state)) {
      return runPunt(out, state, inputs, seq, root, gameKey);
    }

    var snapRng = root.split(gameKey ^ ((long) seq[0] << 32));
    var offenseSide = state.possession();
    var defenseSide = otherSide(offenseSide);
    var offense = offenseSide == Side.HOME ? inputs.home() : inputs.away();
    var defense = defenseSide == Side.HOME ? inputs.home() : inputs.away();
    var offenseCoach = offenseSide == Side.HOME ? inputs.homeCoach() : inputs.awayCoach();
    var defenseCoach = defenseSide == Side.HOME ? inputs.homeCoach() : inputs.awayCoach();
    var call = caller.call(state, offenseCoach, snapRng);
    // Defensive call is selected pre-snap for every scrimmage play. It is not yet fed into the
    // pass/run resolvers' matchup shifts — that wiring is the phase-5 follow-up. Selecting it
    // here keeps the seam exercised so calibration tests can assert league-average blitz / shell
    // distributions and the DC's tendencies have an observable effect.
    var defensiveCall =
        defensiveCallSelector.select(
            state, call.formation(), defenseCoach.defense(), snapRng.split(0xDEFE_7155L));
    Objects.requireNonNull(defensiveCall, "defensiveCall");
    var offPersonnel = personnel.selectOffense(call, state, offense);
    var defPersonnel = personnel.selectDefense(call, offPersonnel, state, defense);

    var preSnapPenalty =
        penaltyModel.preSnap(state, offPersonnel, defPersonnel, snapRng.split(PENALTY_PRE_KEY));
    if (preSnapPenalty.isPresent()) {
      return emitPreSnapPenalty(
          out, state, preSnapPenalty.get(), seq, inputs.gameId(), offenseSide);
    }

    var sequence = seq[0]++;
    var outcome = resolver.resolve(call, state, offPersonnel, defPersonnel, snapRng);

    var secondsOff = clockModel.secondsConsumed(outcome, state, snapRng.split(CLOCK_SPLIT_KEY));
    var clockAfter =
        new GameClock(state.clock().quarter(), state.clock().secondsRemaining() - secondsOff);

    var preYL = state.spot().yardLine();
    var advance = SnapAdvance.derive(outcome, preYL);
    var scoreAfter = scoreAfterPlay(state.score(), offenseSide, defenseSide, advance);

    var event = toEvent(outcome, state, clockAfter, scoreAfter, advance, sequence, inputs.gameId());

    var isScoringOrTurnover =
        advance.touchdown()
            || advance.defensiveTouchdown()
            || advance.safety()
            || advance.turnover() != SnapAdvance.Turnover.NONE;

    if (!isScoringOrTurnover) {
      var liveBall =
          penaltyModel.duringPlay(
              call, outcome, state, offPersonnel, defPersonnel, snapRng.split(PENALTY_LIVE_KEY));
      if (liveBall.isPresent() && shouldAccept(liveBall.get(), advance, offenseSide)) {
        return emitLiveBallPenalty(
            out, state, event, liveBall.get(), clockAfter, sequence, inputs.gameId(), offenseSide);
      }
    }

    out.add(event);

    if (advance.touchdown()) {
      state = state.withScore(scoreAfter).withClock(clockAfter);
      state = emitPat(out, state, inputs, offenseSide, seq, root, gameKey ^ sequence);
      return emitKickoff(
          out, state, inputs, defenseSide, seq, root.split(gameKey ^ sequence ^ 0x5C01DL));
    }
    if (advance.defensiveTouchdown()) {
      state = state.withScore(scoreAfter).withClock(clockAfter);
      state = emitPat(out, state, inputs, defenseSide, seq, root, gameKey ^ sequence);
      return emitKickoff(
          out, state, inputs, offenseSide, seq, root.split(gameKey ^ sequence ^ 0x5C02DL));
    }
    if (advance.safety()) {
      state = state.withScore(scoreAfter).withClock(clockAfter);
      return state.withPossessionAndSpot(defenseSide, new FieldPosition(SAFETY_FREE_KICK_SPOT));
    }
    if (advance.turnover() != SnapAdvance.Turnover.NONE) {
      state = state.withScore(scoreAfter).withClock(clockAfter);
      return state.withPossessionAndSpot(defenseSide, new FieldPosition(advance.endYardLine()));
    }

    var newDd = advanceDown(state.downAndDistance(), advance, preYL);
    if (newDd == null) {
      // Turnover on downs.
      state = state.withClock(clockAfter);
      return state.withPossessionAndSpot(
          defenseSide, new FieldPosition(100 - advance.endYardLine()));
    }
    state =
        state.afterScrimmage(event, clockAfter, new FieldPosition(advance.endYardLine()), newDd);

    var postPlay =
        penaltyModel.postPlay(
            offenseSide, offPersonnel, defPersonnel, snapRng.split(PENALTY_POST_KEY));
    if (postPlay.isPresent()) {
      state = emitPostPlayPenalty(out, state, postPlay.get(), seq, inputs.gameId(), offenseSide);
    }
    return state;
  }

  private GameState emitPreSnapPenalty(
      List<PlayEvent> out,
      GameState state,
      PenaltyDraw.PreSnap draw,
      int[] seq,
      GameId gameId,
      Side offenseSide) {
    var sequence = seq[0]++;
    var preYL = state.spot().yardLine();
    var applied = PenaltyEnforcer.apply(state.downAndDistance(), preYL, preYL, offenseSide, draw);
    var event =
        new PlayEvent.Penalty(
            penaltyId(gameId, sequence),
            gameId,
            sequence,
            state.downAndDistance(),
            state.spot(),
            state.clock(),
            state.clock(),
            state.score(),
            draw.type(),
            draw.against(),
            draw.committedBy(),
            applied.yardsApplied(),
            true,
            Optional.empty());
    out.add(event);
    return afterPenalty(state, applied, state.clock(), offenseSide);
  }

  private GameState emitLiveBallPenalty(
      List<PlayEvent> out,
      GameState state,
      PlayEvent underlying,
      PenaltyDraw.LiveBall draw,
      GameClock clockAfter,
      int sequence,
      GameId gameId,
      Side offenseSide) {
    var preYL = state.spot().yardLine();
    // Live-ball enforcement measures from END_OF_PLAY for personal fouls / post-possession flags;
    // previous-spot for offensive fouls. The enforcer reads `spot` off the draw's enforcement
    // and picks the right basis.
    var basis =
        draw.enforcement().spot() == PenaltyEnforcement.Spot.END_OF_PLAY
            ? endYardLine(underlying, offenseSide)
            : preYL;
    var applied = PenaltyEnforcer.apply(state.downAndDistance(), preYL, basis, offenseSide, draw);
    var event =
        new PlayEvent.Penalty(
            penaltyId(gameId, sequence),
            gameId,
            sequence,
            state.downAndDistance(),
            state.spot(),
            state.clock(),
            clockAfter,
            state.score(),
            draw.type(),
            draw.against(),
            draw.committedBy(),
            applied.yardsApplied(),
            draw.enforcement().replayDown(),
            Optional.of(underlying));
    out.add(event);
    return afterPenalty(state, applied, clockAfter, offenseSide);
  }

  private GameState emitPostPlayPenalty(
      List<PlayEvent> out,
      GameState state,
      PenaltyDraw.PostPlay draw,
      int[] seq,
      GameId gameId,
      Side offenseSide) {
    var sequence = seq[0]++;
    var spot = state.spot().yardLine();
    var applied = PenaltyEnforcer.apply(state.downAndDistance(), spot, spot, offenseSide, draw);
    var event =
        new PlayEvent.Penalty(
            penaltyId(gameId, sequence),
            gameId,
            sequence,
            state.downAndDistance(),
            state.spot(),
            state.clock(),
            state.clock(),
            state.score(),
            draw.type(),
            draw.against(),
            draw.committedBy(),
            applied.yardsApplied(),
            false,
            Optional.empty());
    out.add(event);
    return afterPenalty(state, applied, state.clock(), offenseSide);
  }

  private GameState afterPenalty(
      GameState state, PenaltyEnforcer.Applied applied, GameClock clockAfter, Side offenseSide) {
    return switch (applied) {
      case PenaltyEnforcer.Applied.Next n ->
          new GameState(
              state.score(),
              clockAfter,
              n.nextDownAndDistance(),
              n.newSpot(),
              offenseSide,
              state.drive(),
              state.fatigueSnapCounts(),
              state.injuredPlayers(),
              state.homeTimeouts(),
              state.awayTimeouts(),
              state.phase(),
              state.overtimeRound());
      case PenaltyEnforcer.Applied.TurnoverOnDowns t ->
          state
              .withClock(clockAfter)
              .withPossessionAndSpot(
                  otherSide(offenseSide), new FieldPosition(100 - t.newSpot().yardLine()));
    };
  }

  /**
   * Simple accept/decline: the non-offending side accepts when doing so hurts the offense more (or
   * helps them less) than letting the play stand.
   */
  private static boolean shouldAccept(
      PenaltyDraw.LiveBall draw, SnapAdvance advance, Side offenseSide) {
    var againstOffense = draw.against() == offenseSide;
    var playYards = advance.offensiveYards();
    var penaltyDelta = againstOffense ? -draw.yards() : draw.yards();
    var autoFirstDownBonus = draw.enforcement().autoFirstDown() ? 15 : 0;
    var penaltyEffective = penaltyDelta + (againstOffense ? 0 : autoFirstDownBonus);
    return againstOffense ? penaltyEffective < playYards : penaltyEffective > playYards;
  }

  private static int endYardLine(PlayEvent event, Side offenseSide) {
    // Best-effort: read from known event types that carry an end-of-play spot in offense frame.
    return switch (event) {
      case PlayEvent.Run r -> r.endSpot().yardLine();
      case PlayEvent.PassComplete c -> c.endSpot().yardLine();
      case PlayEvent.Scramble s -> s.endSpot().yardLine();
      // Incompletions/sacks don't advance; fall back to pre-snap spot.
      default -> event.preSnapSpot().yardLine();
    };
  }

  private static PlayId penaltyId(GameId gameId, int sequence) {
    return new PlayId(new UUID(gameId.value().getMostSignificantBits(), 0xF100L | (long) sequence));
  }

  private GameState runFieldGoal(
      List<PlayEvent> out,
      GameState state,
      GameInputs inputs,
      int[] seq,
      SplittableRandomSource root,
      long gameKey) {
    var sequence = seq[0]++;
    var offenseSide = state.possession();
    var defenseSide = otherSide(offenseSide);
    var kicking = offenseSide == Side.HOME ? inputs.home() : inputs.away();
    var rng = root.split(gameKey ^ ((long) sequence << 32) ^ FG_SPLIT_KEY);
    var resolved =
        fieldGoalResolver.resolve(
            kicking,
            offenseSide,
            inputs.gameId(),
            sequence,
            state.spot(),
            state.downAndDistance(),
            state.clock(),
            state.score(),
            rng);
    out.add(resolved.event());
    state =
        state
            .withScore(resolved.scoreAfter())
            .withClock(tickKickClock(state, Kick.FIELD_GOAL, rng));

    if (resolved.made()) {
      return emitKickoff(
          out, state, inputs, defenseSide, seq, root.split(gameKey ^ sequence ^ 0x5C03DL));
    }
    var takeover = resolved.receivingTakeoverYardLine().orElse(SAFETY_FREE_KICK_SPOT);
    return state.withPossessionAndSpot(defenseSide, new FieldPosition(takeover));
  }

  private GameState runPunt(
      List<PlayEvent> out,
      GameState state,
      GameInputs inputs,
      int[] seq,
      SplittableRandomSource root,
      long gameKey) {
    var sequence = seq[0]++;
    var offenseSide = state.possession();
    var defenseSide = otherSide(offenseSide);
    var kicking = offenseSide == Side.HOME ? inputs.home() : inputs.away();
    var receiving = defenseSide == Side.HOME ? inputs.home() : inputs.away();
    var rng = root.split(gameKey ^ ((long) sequence << 32) ^ PUNT_SPLIT_KEY);
    var resolved =
        puntResolver.resolve(
            kicking,
            receiving,
            offenseSide,
            inputs.gameId(),
            sequence,
            state.spot(),
            state.downAndDistance(),
            state.clock(),
            state.score(),
            rng);
    out.add(resolved.event());
    state = state.withClock(tickKickClock(state, Kick.PUNT, rng));
    return state.withPossessionAndSpot(
        defenseSide, new FieldPosition(resolved.receivingTakeoverYardLine()));
  }

  private GameState emitPat(
      List<PlayEvent> out,
      GameState state,
      GameInputs inputs,
      Side scoringSide,
      int[] seq,
      SplittableRandomSource root,
      long key) {
    var sequence = seq[0]++;
    var kicking = scoringSide == Side.HOME ? inputs.home() : inputs.away();
    var rng = root.split(key ^ PAT_SPLIT_KEY ^ ((long) sequence << 32));
    var resolved =
        extraPointResolver.resolve(
            kicking, scoringSide, inputs.gameId(), sequence, state.clock(), state.score(), rng);
    out.add(resolved.event());
    return state
        .withScore(resolved.scoreAfter())
        .withClock(tickKickClock(state, Kick.EXTRA_POINT, rng));
  }

  private GameClock tickKickClock(GameState state, Kick kick, RandomSource rng) {
    var consumed = clockModel.secondsConsumedForKick(kick, state, rng);
    return new GameClock(state.clock().quarter(), state.clock().secondsRemaining() - consumed);
  }

  private boolean shouldAttemptFieldGoal(GameState state) {
    var dd = state.downAndDistance();
    if (dd.down() != 4) {
      return false;
    }
    return state.spot().yardLine() >= FIELD_GOAL_MIN_YARD_LINE;
  }

  private boolean shouldPunt(GameState state) {
    var dd = state.downAndDistance();
    if (dd.down() != 4) {
      return false;
    }
    return state.spot().yardLine() < FIELD_GOAL_MIN_YARD_LINE;
  }

  private static Side otherSide(Side side) {
    return side == Side.HOME ? Side.AWAY : Side.HOME;
  }

  private static Score scoreAfterPlay(
      Score current, Side offense, Side defense, SnapAdvance advance) {
    if (advance.touchdown()) {
      return current.plus(offense, 6);
    }
    if (advance.defensiveTouchdown()) {
      return current.plus(defense, 6);
    }
    if (advance.safety()) {
      return current.plus(defense, 2);
    }
    return current;
  }

  /**
   * Advance down and distance after a live-ball snap. Returns {@code null} to signal turnover on
   * downs (4th down failed).
   */
  private static DownAndDistance advanceDown(DownAndDistance dd, SnapAdvance advance, int preYl) {
    if (dd.down() == 0) {
      // Freshly-spotted ball after a kickoff or turnover; normalize to 1st-and-10 (or goal-to-go).
      return GameState.freshFirstDown(advance.endYardLine());
    }
    if (advance.offensiveYards() >= dd.yardsToGo()) {
      return GameState.freshFirstDown(advance.endYardLine());
    }
    var nextDown = dd.down() + 1;
    if (nextDown > 4) {
      return null;
    }
    var remaining = Math.max(1, dd.yardsToGo() - Math.max(0, advance.offensiveYards()));
    // If a big loss moved past prior LOS the "remaining" math still caps at 1 by design — the
    // resolver never produces a first down from behind, so forcing a minimum of 1 keeps
    // downstream narration sensible.
    return new DownAndDistance(nextDown, remaining);
  }

  private GameState endOfQuarter(
      List<PlayEvent> out,
      GameState state,
      GameInputs inputs,
      Side openingReceiver,
      int[] seq,
      SplittableRandomSource root,
      long gameKey) {
    var quarter = state.clock().quarter();
    out.add(endOfQuarterEvent(state, inputs.gameId(), seq[0]++, quarter));

    if (quarter == 4) {
      if (state.score().home() != state.score().away()) {
        return state.withPhase(GameState.Phase.FINAL);
      }
      var otClock = new GameClock(5, OVERTIME_PERIOD_SECONDS);
      var withOt = state.withPhase(GameState.Phase.OVERTIME).withClock(otClock);
      return emitKickoff(out, withOt, inputs, Side.HOME, seq, root.split(gameKey ^ 0xD1AABBL));
    }

    if (quarter >= 5) {
      return state.withPhase(GameState.Phase.FINAL);
    }

    var nextClock = new GameClock(quarter + 1, REGULATION_QUARTER_SECONDS);
    var advanced = state.withClock(nextClock);
    if (quarter == 2) {
      var secondHalfReceiver = openingReceiver == Side.HOME ? Side.AWAY : Side.HOME;
      return emitKickoff(
          out, advanced, inputs, secondHalfReceiver, seq, root.split(gameKey ^ 0xB00BL));
    }
    return advanced;
  }

  private GameState emitKickoff(
      List<PlayEvent> out,
      GameState state,
      GameInputs inputs,
      Side receivingSide,
      int[] seq,
      RandomSource rng) {
    var kickingSide = receivingSide == Side.HOME ? Side.AWAY : Side.HOME;
    var kicking = kickingSide == Side.HOME ? inputs.home() : inputs.away();
    var receiving = receivingSide == Side.HOME ? inputs.home() : inputs.away();
    var resolved =
        kickoffResolver.resolve(
            kicking,
            receiving,
            receivingSide,
            inputs.gameId(),
            seq[0]++,
            state.clock(),
            state.score(),
            rng);
    out.add(resolved.event());
    state = state.withClock(tickKickClock(state, Kick.KICKOFF, rng));
    return state.withPossessionAndSpot(
        resolved.nextPossession(), new FieldPosition(resolved.nextSpotYardLine()));
  }

  private static PlayEvent.EndOfQuarter endOfQuarterEvent(
      GameState state, GameId gameId, int sequence, int quarter) {
    var id =
        new PlayId(new UUID(gameId.value().getMostSignificantBits(), 0xEE00L | (long) sequence));
    var clock = new GameClock(quarter, 0);
    return new PlayEvent.EndOfQuarter(
        id,
        gameId,
        sequence,
        state.downAndDistance(),
        state.spot(),
        clock,
        clock,
        state.score(),
        quarter);
  }

  private static PlayEvent toEvent(
      PlayOutcome outcome,
      GameState state,
      GameClock clockAfter,
      Score scoreAfter,
      SnapAdvance advance,
      int sequence,
      GameId gameId) {
    var id = new PlayId(new UUID(gameId.value().getMostSignificantBits(), sequence));
    var preSnap = state.downAndDistance();
    var preSnapSpot = state.spot();
    var clockBefore = state.clock();
    var offenseEndSpot = offenseEndSpot(preSnapSpot, advance);
    var firstDown =
        !advance.touchdown()
            && advance.turnover() == SnapAdvance.Turnover.NONE
            && !advance.safety()
            && advance.offensiveYards() >= preSnap.yardsToGo();

    return switch (outcome) {
      case PassOutcome.PassComplete c ->
          new PlayEvent.PassComplete(
              id,
              gameId,
              sequence,
              preSnap,
              preSnapSpot,
              clockBefore,
              clockAfter,
              scoreAfter,
              c.qb(),
              c.target(),
              c.airYards(),
              c.yardsAfterCatch(),
              advance.offensiveYards(),
              offenseEndSpot,
              c.tackler(),
              c.defendersInCoverage(),
              advance.touchdown(),
              firstDown);
      case PassOutcome.PassIncomplete i ->
          new PlayEvent.PassIncomplete(
              id,
              gameId,
              sequence,
              preSnap,
              preSnapSpot,
              clockBefore,
              clockAfter,
              scoreAfter,
              i.qb(),
              i.target(),
              i.airYards(),
              i.reason(),
              i.defender());
      case PassOutcome.Sack s ->
          new PlayEvent.Sack(
              id,
              gameId,
              sequence,
              preSnap,
              preSnapSpot,
              clockBefore,
              clockAfter,
              scoreAfter,
              s.qb(),
              s.sackers(),
              Math.abs(advance.offensiveYards()),
              s.fumble());
      case PassOutcome.Scramble s ->
          new PlayEvent.Scramble(
              id,
              gameId,
              sequence,
              preSnap,
              preSnapSpot,
              clockBefore,
              clockAfter,
              scoreAfter,
              s.qb(),
              advance.offensiveYards(),
              offenseEndSpot,
              s.tackler(),
              s.slideOrOob(),
              advance.touchdown());
      case PassOutcome.Interception x ->
          new PlayEvent.Interception(
              id,
              gameId,
              sequence,
              preSnap,
              preSnapSpot,
              clockBefore,
              clockAfter,
              scoreAfter,
              x.qb(),
              x.intendedTarget(),
              x.interceptor(),
              Math.max(0, x.returnYards()),
              new FieldPosition(100 - advance.endYardLine()),
              advance.defensiveTouchdown());
      case RunOutcome.Run r ->
          new PlayEvent.Run(
              id,
              gameId,
              sequence,
              preSnap,
              preSnapSpot,
              clockBefore,
              clockAfter,
              scoreAfter,
              r.carrier(),
              r.concept(),
              advance.offensiveYards(),
              offenseEndSpot,
              r.tackler(),
              r.fumble(),
              advance.touchdown(),
              firstDown,
              0L);
    };
  }

  private static FieldPosition offenseEndSpot(FieldPosition preSnapSpot, SnapAdvance advance) {
    if (advance.turnover() != SnapAdvance.Turnover.NONE) {
      // Possession flipped; express the ball spot in the pre-snap offense's frame so the event
      // narration reads naturally.
      return new FieldPosition(100 - advance.endYardLine());
    }
    return new FieldPosition(advance.endYardLine());
  }
}
