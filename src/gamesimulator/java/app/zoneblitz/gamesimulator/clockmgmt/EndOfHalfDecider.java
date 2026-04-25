package app.zoneblitz.gamesimulator.clockmgmt;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.playcalling.PlayCaller;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Coach;
import java.util.Optional;

/**
 * Pre-snap clock-management decision: should the offense kneel out the clock or spike to stop it?
 * Returns {@link Optional#empty()} to let the normal {@link PlayCaller} handle the snap.
 *
 * <p>Implementations are stateless. The engine owns the actual emission of {@link
 * app.zoneblitz.gamesimulator.event.PlayEvent.Kneel} / {@link
 * app.zoneblitz.gamesimulator.event.PlayEvent.Spike} and the down/clock bookkeeping that follows.
 *
 * <p>Two situational windows are intended:
 *
 * <ul>
 *   <li>{@link Action#KNEEL} — victory formation: the offense is winning late, can drain the rest
 *       of the clock by burning play-clock seconds, and the trailing defense has no realistic way
 *       to get the ball back.
 *   <li>{@link Action#SPIKE} — two-minute drill: the offense just gained yards, the clock is
 *       running, time is short, and timeouts are scarce so spiking the ball to stop the clock beats
 *       burning a snap on a real play.
 * </ul>
 */
public interface EndOfHalfDecider {

  /** What the offense should do on this snap, or empty to let the play caller proceed. */
  Optional<Action> decide(GameState state, Coach offensiveCoach, RandomSource rng);

  /** A decider that never overrides the play call — for tests that want vanilla snap behavior. */
  static EndOfHalfDecider never() {
    return (state, coach, rng) -> Optional.empty();
  }

  /** The clock-management action the offense takes pre-snap. */
  enum Action {
    /** Victory formation kneel-down. */
    KNEEL,
    /** Spike the ball to stop the clock. */
    SPIKE
  }
}
