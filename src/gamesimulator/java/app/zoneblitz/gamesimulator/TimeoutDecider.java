package app.zoneblitz.gamesimulator;

import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Coach;
import java.util.Optional;

/**
 * Pre-snap decision: should either side burn a timeout? Returns the {@link Side} calling the
 * timeout, or {@link Optional#empty()} to let the snap proceed.
 *
 * <p>Implementations consult {@link GameState#timeoutsFor(Side)} to respect the zero-floor and are
 * expected to be stateless — {@link GameSimulator} owns deduction via {@link
 * GameState#withTimeoutUsed(Side)} and the event emission. Coach {@code clockAwareness} tendency is
 * the primary aggressiveness knob.
 */
public interface TimeoutDecider {

  /**
   * Decide whether to call a timeout before the next snap. Returns the calling side, or empty if
   * neither side should burn one in this state. Invoked pre-snap, after any kickoff/PAT sequence
   * but before personnel selection.
   */
  Optional<Side> decide(GameState state, Coach homeCoach, Coach awayCoach, RandomSource rng);

  /** A decider that never calls a timeout — for tests that want to exercise other behavior. */
  static TimeoutDecider never() {
    return (state, home, away, rng) -> Optional.empty();
  }
}
