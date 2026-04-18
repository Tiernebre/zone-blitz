package app.zoneblitz.gamesimulator;

import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Coach;
import java.util.Optional;

/**
 * League-average timeout decision layer. Fires a timeout when the calling side is in a late-half
 * clock-management window and has timeouts remaining; per-snap probability scales with the coach's
 * {@code clockAwareness} tendency (0-100). Situation priors dominate — tendency is a nudge.
 *
 * <p>Late-half window: final two minutes of Q2 or Q4, or any snap in overtime. Within the window:
 *
 * <ul>
 *   <li>Trailing offense burns timeouts to pressure play calls when they must score.
 *   <li>Trailing defense burns timeouts to recover clock so their offense gets the ball back.
 * </ul>
 *
 * A tied-game final two minutes of Q4 also triggers defense-side usage (two-minute-drill prep).
 * Per-snap fire probability targets roughly league-average 5-7 combined timeouts per game at the
 * neutral (50) clock-awareness setting.
 */
public final class TendencyTimeoutDecider implements TimeoutDecider {

  private static final int LATE_HALF_SECONDS = 120;
  private static final double BASE_FIRE_RATE = 0.45;

  @Override
  public Optional<Side> decide(
      GameState state, Coach homeCoach, Coach awayCoach, RandomSource rng) {
    if (!isLateHalf(state)) {
      return Optional.empty();
    }
    var offense = state.possession();
    var defense = offense == Side.HOME ? Side.AWAY : Side.HOME;
    var offenseCoach = offense == Side.HOME ? homeCoach : awayCoach;
    var defenseCoach = defense == Side.HOME ? homeCoach : awayCoach;

    var offenseTrailing = isTrailing(state, offense);
    var defenseTrailing = isTrailing(state, defense);
    var tiedLateFourth =
        state.clock().quarter() == 4 && state.score().home() == state.score().away();

    // Defense-side first: losing defense needs the clock more than a losing offense does, since
    // the offense already owns the ball. This mirrors real NFL late-game timeout ordering.
    if (defenseTrailing && state.timeoutsFor(defense) > 0) {
      if (roll(rng, fireRate(defenseCoach.offense().clockAwareness()))) {
        return Optional.of(defense);
      }
    }
    if (tiedLateFourth && state.timeoutsFor(defense) > 0) {
      if (roll(rng, fireRate(defenseCoach.offense().clockAwareness()) * 0.5)) {
        return Optional.of(defense);
      }
    }
    if (offenseTrailing && state.timeoutsFor(offense) > 0) {
      if (roll(rng, fireRate(offenseCoach.offense().clockAwareness()) * 0.6)) {
        return Optional.of(offense);
      }
    }
    return Optional.empty();
  }

  private static boolean isLateHalf(GameState state) {
    var quarter = state.clock().quarter();
    var seconds = state.clock().secondsRemaining();
    if (quarter >= 5) {
      return true;
    }
    return (quarter == 2 || quarter == 4) && seconds > 0 && seconds <= LATE_HALF_SECONDS;
  }

  private static boolean isTrailing(GameState state, Side side) {
    return side == Side.HOME
        ? state.score().home() < state.score().away()
        : state.score().away() < state.score().home();
  }

  private static double fireRate(int clockAwareness) {
    var factor = 0.5 + (clockAwareness / 100.0);
    return BASE_FIRE_RATE * factor;
  }

  private static boolean roll(RandomSource rng, double probability) {
    return rng.nextDouble() < probability;
  }
}
