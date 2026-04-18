package app.zoneblitz.gamesimulator.clock;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.resolver.PlayOutcome;

/**
 * Decides how many seconds a single snap consumes off the game clock. Callers pass the resolved
 * {@link PlayOutcome} and the pre-snap {@link GameState}; the returned value is subtracted from
 * {@code state.clock().secondsRemaining()}.
 *
 * <p>Implementations should cap the result at the remaining seconds in the current quarter so
 * callers can treat the return as authoritative.
 */
public interface ClockModel {

  /** Seconds consumed by {@code outcome} given {@code preSnap} state. Always {@code >= 0}. */
  int secondsConsumed(PlayOutcome outcome, GameState preSnap);
}
