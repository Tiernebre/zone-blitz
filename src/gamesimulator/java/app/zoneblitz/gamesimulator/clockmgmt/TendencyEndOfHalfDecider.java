package app.zoneblitz.gamesimulator.clockmgmt;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Coach;
import java.util.Optional;

/**
 * League-average end-of-half clock-management decisions.
 *
 * <p>Kneel triggers when the offense is leading in the final two minutes of Q4 (or any OT) and the
 * defense cannot realistically stop the clock — i.e. the lead is large enough that no single
 * possession evens it, or the defense has no timeouts left and the play clock would burn through
 * the remaining seconds. The classic victory-formation case.
 *
 * <p>Spike triggers when the offense is moving in a two-minute drill, the clock is running, and
 * timeouts are too scarce to stop it before the next snap. Stops the clock at the cost of a down.
 */
public final class TendencyEndOfHalfDecider implements EndOfHalfDecider {

  private static final int LATE_GAME_SECONDS = 120;
  private static final int KNEEL_PLAY_CLOCK_DRAIN = 42;
  private static final int SPIKE_WINDOW_SECONDS = 40;

  @Override
  public Optional<Action> decide(GameState state, Coach offensiveCoach, RandomSource rng) {
    if (shouldKneel(state)) {
      return Optional.of(Action.KNEEL);
    }
    if (shouldSpike(state)) {
      return Optional.of(Action.SPIKE);
    }
    return Optional.empty();
  }

  private static boolean shouldKneel(GameState state) {
    if (!isLateRegulationOrOvertime(state)) {
      return false;
    }
    var offense = state.possession();
    var defense = offense == Side.HOME ? Side.AWAY : Side.HOME;
    var leadingBy = leadFor(state, offense);
    if (leadingBy <= 0) {
      return false;
    }
    var defenseTimeouts = state.timeoutsFor(defense);
    var seconds = state.clock().secondsRemaining();
    var dd = state.downAndDistance();
    var downsRemaining = Math.max(0, 4 - dd.down());
    if (downsRemaining <= 0) {
      return seconds <= KNEEL_PLAY_CLOCK_DRAIN;
    }
    var drainableSnaps = Math.max(0, downsRemaining - defenseTimeouts);
    var clockBurnableByKneels = drainableSnaps * KNEEL_PLAY_CLOCK_DRAIN;
    return seconds <= clockBurnableByKneels;
  }

  private static boolean shouldSpike(GameState state) {
    if (!isLateHalf(state)) {
      return false;
    }
    var seconds = state.clock().secondsRemaining();
    if (seconds <= 3 || seconds > SPIKE_WINDOW_SECONDS) {
      return false;
    }
    var offense = state.possession();
    if (state.timeoutsFor(offense) > 0) {
      return false;
    }
    if (leadFor(state, offense) > 8) {
      return false;
    }
    var dd = state.downAndDistance();
    if (dd.down() >= 4) {
      return false;
    }
    return state.spot().yardLine() < 95;
  }

  private static boolean isLateRegulationOrOvertime(GameState state) {
    var quarter = state.clock().quarter();
    if (quarter >= 5) {
      return true;
    }
    return quarter == 4 && state.clock().secondsRemaining() <= LATE_GAME_SECONDS;
  }

  private static boolean isLateHalf(GameState state) {
    var quarter = state.clock().quarter();
    if (quarter >= 5) {
      return true;
    }
    return (quarter == 2 || quarter == 4) && state.clock().secondsRemaining() <= LATE_GAME_SECONDS;
  }

  private static int leadFor(GameState state, Side side) {
    var score = state.score();
    return side == Side.HOME ? score.home() - score.away() : score.away() - score.home();
  }
}
