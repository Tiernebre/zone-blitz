package app.zoneblitz.gamesimulator.output;

import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import java.util.stream.Stream;

/**
 * Pure fold over a {@link PlayEvent} stream into {@link GameStats}.
 *
 * <p>Two modes, same semantics:
 *
 * <ul>
 *   <li>{@link #finalize(GameId, TeamAssignment, Stream)} — terminal fold; one call, one result.
 *   <li>{@link #incremental(GameId, TeamAssignment)} — returns an immutable {@link StatsProjection}
 *       accumulator; call {@link StatsProjection#apply(PlayEvent)} per event and {@link
 *       StatsProjection#snapshot()} to materialize.
 * </ul>
 *
 * <p>Implementations are pure — no I/O, no wall-clock, no mutation of inputs. {@link
 * TeamAssignment} carries the player/team mapping consumers must supply because {@link PlayEvent}
 * does not.
 */
public interface StatsAssembler {

  /** Folds {@code events} into a final {@link GameStats}. */
  GameStats finalize(GameId game, TeamAssignment assignment, Stream<PlayEvent> events);

  /** Returns an empty incremental projection. */
  StatsProjection incremental(GameId game, TeamAssignment assignment);
}
