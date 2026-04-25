package app.zoneblitz.gamesimulator.clockmgmt;

import app.zoneblitz.gamesimulator.GameState;
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
 *
 * <p>Coach {@link app.zoneblitz.gamesimulator.roster.CoachQuality#decisionQuality()} layers on top
 * of clockAwareness: in a legitimate clock-management window it scales the fire rate by {@code 1 ±
 * 0.2} around neutral (so a quality-100 coach is 20% more reliable than a neutral coach, a
 * quality-0 coach 20% less). Outside any legitimate window (tied late-Q2, tied OT, etc.) a
 * low-quality coach has a small chance of wasting a timeout — up to 2% per-snap at quality=0, zero
 * at quality≥50.
 */
public final class TendencyTimeoutDecider implements TimeoutDecider {

  private static final int LATE_HALF_SECONDS = 120;
  private static final double BASE_FIRE_RATE = 0.45;
  private static final double CORRECT_WINDOW_MAX_SHIFT = 0.2;
  private static final double WRONG_WINDOW_MAX_RATE = 0.02;

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
      var rate =
          fireRate(defenseCoach.offense().clockAwareness())
              * correctWindowMultiplier(defenseCoach.quality().decisionQuality());
      if (roll(rng, rate)) {
        return Optional.of(defense);
      }
    }
    if (tiedLateFourth && state.timeoutsFor(defense) > 0) {
      var rate =
          fireRate(defenseCoach.offense().clockAwareness())
              * 0.5
              * correctWindowMultiplier(defenseCoach.quality().decisionQuality());
      if (roll(rng, rate)) {
        return Optional.of(defense);
      }
    }
    if (offenseTrailing && state.timeoutsFor(offense) > 0) {
      var rate =
          fireRate(offenseCoach.offense().clockAwareness())
              * 0.6
              * correctWindowMultiplier(offenseCoach.quality().decisionQuality());
      if (roll(rng, rate)) {
        return Optional.of(offense);
      }
    }
    if (!defenseTrailing && !offenseTrailing && !tiedLateFourth) {
      if (state.timeoutsFor(defense) > 0
          && roll(rng, wrongWindowFireRate(defenseCoach.quality().decisionQuality()))) {
        return Optional.of(defense);
      }
      if (state.timeoutsFor(offense) > 0
          && roll(rng, wrongWindowFireRate(offenseCoach.quality().decisionQuality()))) {
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

  private static double correctWindowMultiplier(int decisionQuality) {
    return 1.0 + (decisionQuality - 50) / 50.0 * CORRECT_WINDOW_MAX_SHIFT;
  }

  private static double wrongWindowFireRate(int decisionQuality) {
    var shortfall = Math.max(0, 50 - decisionQuality);
    return shortfall / 50.0 * WRONG_WINDOW_MAX_RATE;
  }

  private static boolean roll(RandomSource rng, double probability) {
    return rng.nextDouble() < probability;
  }
}
