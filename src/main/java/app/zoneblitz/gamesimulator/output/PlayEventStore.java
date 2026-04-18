package app.zoneblitz.gamesimulator.output;

import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import java.util.List;

/**
 * Persistence seam for the event stream emitted by the simulation engine.
 *
 * <p>Events are the source of truth for a simulated game: box scores, drive charts and historical
 * views are all derived from the persisted stream. Implementations must preserve {@link
 * PlayEvent#sequence()} ordering; a round-trip through {@link #append(GameId, List)} and {@link
 * #loadByGameId(GameId)} must return events in monotonic sequence order.
 *
 * <p>Implementations are expected to be transactional: a batch append either lands entirely or not
 * at all.
 */
public interface PlayEventStore {

  /**
   * Persists a batch of events for a single game.
   *
   * <p>Callers supply events already tagged with their {@link PlayEvent#gameId()} and {@link
   * PlayEvent#sequence()}; the store persists them verbatim. Re-appending a {@code (gameId,
   * sequence)} pair that already exists is a programmer error and will surface as a
   * unique-constraint violation — events are append-only and deterministic by seed, so callers
   * should never replay writes.
   *
   * @param gameId the game the events belong to; must match {@code event.gameId()} for each entry.
   * @param events events to persist. Empty list is a no-op.
   */
  void append(GameId gameId, List<PlayEvent> events);

  /**
   * Loads every persisted event for the given game, ordered by {@code sequence} ascending.
   *
   * @return immutable list of events. Empty when no events are persisted for the game.
   */
  List<PlayEvent> loadByGameId(GameId gameId);
}
