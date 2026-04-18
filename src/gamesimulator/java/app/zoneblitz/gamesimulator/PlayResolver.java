package app.zoneblitz.gamesimulator;

import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.rng.RandomSource;

/**
 * Resolves an offensive play call into a concrete {@link PlayEvent}. Must be pure given its inputs;
 * all randomness flows through the supplied {@link RandomSource}.
 */
interface PlayResolver {

  /**
   * Resolve the supplied play into an event. {@code sequence} is the monotonic sequence number to
   * stamp on the emitted event; implementations must use it verbatim.
   */
  PlayEvent resolve(PlayCaller.PlayCall call, GameState state, RandomSource rng, int sequence);
}
