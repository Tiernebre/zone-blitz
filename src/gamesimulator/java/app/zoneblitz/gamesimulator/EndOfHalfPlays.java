package app.zoneblitz.gamesimulator;

import app.zoneblitz.gamesimulator.clockmgmt.EndOfHalfDecider;
import app.zoneblitz.gamesimulator.event.FieldPosition;
import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.PlayId;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import java.util.List;
import java.util.UUID;

/**
 * Emits clock-management plays — kneel-downs and spikes — triggered by {@link EndOfHalfDecider}
 * prior to an ordinary snap. Pure statics; state transitions come from reused engine helpers.
 */
final class EndOfHalfPlays {

  private static final long KNEEL_SPLIT_KEY = 0xE0FA_1F01L;
  private static final long SPIKE_SPLIT_KEY = 0xE0FA_1F02L;
  private static final int KNEEL_LOSS_YARDS = 1;
  private static final int KNEEL_CLOCK_BURN = 42;
  private static final int SPIKE_CLOCK_BURN = 3;

  private EndOfHalfPlays() {}

  static GameState runKneel(
      List<PlayEvent> out,
      GameState state,
      GameInputs inputs,
      int[] seq,
      SplittableRandomSource root,
      long gameKey) {
    var sequence = seq[0]++;
    root.split(gameKey ^ KNEEL_SPLIT_KEY ^ ((long) sequence << 32));
    var preYL = state.spot().yardLine();
    var endYL = Math.max(0, preYL - KNEEL_LOSS_YARDS);
    var clockBurn = Math.min(KNEEL_CLOCK_BURN, state.clock().secondsRemaining());
    var clockAfter =
        new GameClock(state.clock().quarter(), state.clock().secondsRemaining() - clockBurn);
    var id =
        new PlayId(
            new UUID(inputs.gameId().value().getMostSignificantBits(), 0xC100L | (long) sequence));
    var event =
        new PlayEvent.Kneel(
            id,
            inputs.gameId(),
            sequence,
            state.downAndDistance(),
            state.spot(),
            state.clock(),
            clockAfter,
            state.score());
    out.add(event);

    var offenseSide = state.possession();
    var newDd = DownProgression.advance(state.downAndDistance(), kneelAdvance(endYL, preYL), preYL);
    if (newDd == null) {
      state = state.withClock(clockAfter);
      state = PeriodController.concludeOvertimePossession(state, offenseSide);
      if (state.phase() == GameState.Phase.FINAL) {
        return state;
      }
      return state.withPossessionAndSpot(
          offenseSide == Side.HOME ? Side.AWAY : Side.HOME, new FieldPosition(100 - endYL));
    }
    return state.afterScrimmage(event, clockAfter, new FieldPosition(endYL), newDd);
  }

  static GameState runSpike(
      List<PlayEvent> out,
      GameState state,
      GameInputs inputs,
      int[] seq,
      SplittableRandomSource root,
      long gameKey) {
    var sequence = seq[0]++;
    root.split(gameKey ^ SPIKE_SPLIT_KEY ^ ((long) sequence << 32));
    var clockBurn = Math.min(SPIKE_CLOCK_BURN, state.clock().secondsRemaining());
    var clockAfter =
        new GameClock(state.clock().quarter(), state.clock().secondsRemaining() - clockBurn);
    var id =
        new PlayId(
            new UUID(inputs.gameId().value().getMostSignificantBits(), 0xC200L | (long) sequence));
    var event =
        new PlayEvent.Spike(
            id,
            inputs.gameId(),
            sequence,
            state.downAndDistance(),
            state.spot(),
            state.clock(),
            clockAfter,
            state.score());
    out.add(event);

    var offenseSide = state.possession();
    var preYL = state.spot().yardLine();
    var newDd = DownProgression.advance(state.downAndDistance(), spikeAdvance(preYL), preYL);
    if (newDd == null) {
      state = state.withClock(clockAfter);
      state = PeriodController.concludeOvertimePossession(state, offenseSide);
      if (state.phase() == GameState.Phase.FINAL) {
        return state;
      }
      return state.withPossessionAndSpot(
          offenseSide == Side.HOME ? Side.AWAY : Side.HOME, new FieldPosition(100 - preYL));
    }
    return state.afterScrimmage(event, clockAfter, state.spot(), newDd);
  }

  private static SnapAdvance kneelAdvance(int endYl, int preYl) {
    return new SnapAdvance(endYl - preYl, endYl, false, false, false, SnapAdvance.Turnover.NONE);
  }

  private static SnapAdvance spikeAdvance(int preYl) {
    return new SnapAdvance(0, preYl, false, false, false, SnapAdvance.Turnover.NONE);
  }
}
