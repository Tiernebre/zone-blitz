package app.zoneblitz.gamesimulator;

import app.zoneblitz.gamesimulator.clock.ClockModel;
import app.zoneblitz.gamesimulator.event.FieldPosition;
import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.PlayId;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.kickoff.KickoffResolver;
import app.zoneblitz.gamesimulator.personnel.PersonnelSelector;
import app.zoneblitz.gamesimulator.resolver.PassOutcome;
import app.zoneblitz.gamesimulator.resolver.PlayOutcome;
import app.zoneblitz.gamesimulator.resolver.PlayResolver;
import app.zoneblitz.gamesimulator.resolver.RunOutcome;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Stream;

/**
 * Walking-skeleton engine. Advances {@link GameState} snap-over-snap: resolves one snap via the
 * supplied {@link PlayResolver}, ticks the game clock using the supplied {@link ClockModel}, and
 * emits {@link PlayEvent.EndOfQuarter} / {@link PlayEvent.Kickoff} at period boundaries. Halftime
 * flips possession per the coin-toss rule; an end-of-regulation tie triggers a single overtime
 * period; NFL-compliant OT rules are deferred.
 */
final class GameSimulator implements SimulateGame {

  private static final int REGULATION_QUARTER_SECONDS = 15 * 60;
  private static final int OVERTIME_PERIOD_SECONDS = 10 * 60;
  private static final int HARD_SNAP_CAP = 500;
  private static final long CLOCK_SPLIT_KEY = 0x3333_eeffL;

  private final PlayCaller caller;
  private final PersonnelSelector personnel;
  private final PlayResolver resolver;
  private final ClockModel clockModel;
  private final KickoffResolver kickoffResolver;

  GameSimulator(
      PlayCaller caller,
      PersonnelSelector personnel,
      PlayResolver resolver,
      ClockModel clockModel,
      KickoffResolver kickoffResolver) {
    this.caller = Objects.requireNonNull(caller, "caller");
    this.personnel = Objects.requireNonNull(personnel, "personnel");
    this.resolver = Objects.requireNonNull(resolver, "resolver");
    this.clockModel = Objects.requireNonNull(clockModel, "clockModel");
    this.kickoffResolver = Objects.requireNonNull(kickoffResolver, "kickoffResolver");
  }

  @Override
  public Stream<PlayEvent> simulate(GameInputs inputs) {
    Objects.requireNonNull(inputs, "inputs");
    var seed = inputs.seed().orElse(0L);
    var root = new SplittableRandomSource(seed);
    var gameKey = (long) inputs.gameId().value().hashCode();

    // HOME receives the opening kickoff (coin-toss stub). AWAY kicks, so HOME gets the 2H kick.
    var openingReceiver = Side.HOME;
    var events = new ArrayList<PlayEvent>();
    var seq = new int[] {0};

    var state = GameState.initial().withClock(new GameClock(1, REGULATION_QUARTER_SECONDS));

    // Opening kickoff
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
    var sequence = seq[0]++;
    var snapRng = root.split(gameKey ^ ((long) sequence << 32));
    var offense = state.possession() == Side.HOME ? inputs.home() : inputs.away();
    var defense = state.possession() == Side.HOME ? inputs.away() : inputs.home();
    var call = caller.call(state);
    var offPersonnel = personnel.selectOffense(call, state, offense);
    var defPersonnel = personnel.selectDefense(call, offPersonnel, state, defense);
    var outcome = resolver.resolve(call, state, offPersonnel, defPersonnel, snapRng);

    var secondsOff = clockModel.secondsConsumed(outcome, state, snapRng.split(CLOCK_SPLIT_KEY));
    var clockAfter =
        new GameClock(state.clock().quarter(), state.clock().secondsRemaining() - secondsOff);
    var event = toEvent(outcome, state, clockAfter, inputs.gameId(), sequence);
    out.add(event);
    return state.apply(event, clockAfter);
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

    // End of regulation: decide FINAL vs OT.
    if (quarter == 4) {
      if (state.score().home() != state.score().away()) {
        return state.withPhase(GameState.Phase.FINAL);
      }
      var otClock = new GameClock(5, OVERTIME_PERIOD_SECONDS);
      var withOt = state.withPhase(GameState.Phase.OVERTIME).withClock(otClock);
      // OT kickoff: AWAY kicks to HOME (stub coin toss).
      return emitKickoff(out, withOt, inputs, Side.HOME, seq, root.split(gameKey ^ 0xD1AABBL));
    }

    // End of OT period (quarter == 5): FINAL regardless of score.
    if (quarter >= 5) {
      return state.withPhase(GameState.Phase.FINAL);
    }

    // Q1→Q2, Q2→Q3, Q3→Q4.
    var nextClock = new GameClock(quarter + 1, REGULATION_QUARTER_SECONDS);
    var advanced = state.withClock(nextClock);
    if (quarter == 2) {
      // Halftime: receiving team now kicks (i.e. openingReceiver kicks to opening kicker's team).
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
      app.zoneblitz.gamesimulator.rng.RandomSource rng) {
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
    return state.withPossessionAndSpot(
        receivingSide, new FieldPosition(resolved.receivingSpotYardLine()));
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
      PlayOutcome outcome, GameState state, GameClock clockAfter, GameId gameId, int sequence) {
    var id = new PlayId(new UUID(gameId.value().getMostSignificantBits(), sequence));
    var preSnap = state.downAndDistance();
    var preSnapSpot = state.spot();
    var clockBefore = state.clock();
    Score scoreAfter = state.score();
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
              c.totalYards(),
              new FieldPosition(preSnapSpot.yardLine() + c.totalYards()),
              c.tackler(),
              c.defendersInCoverage(),
              c.touchdown(),
              c.firstDown());
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
              s.yardsLost(),
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
              s.yards(),
              new FieldPosition(preSnapSpot.yardLine() + s.yards()),
              s.tackler(),
              s.slideOrOob(),
              s.touchdown());
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
              x.returnYards(),
              preSnapSpot,
              x.touchdown());
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
              r.yards(),
              new FieldPosition(preSnapSpot.yardLine() + r.yards()),
              r.tackler(),
              r.fumble(),
              r.touchdown(),
              r.firstDown(),
              0L);
    };
  }
}
