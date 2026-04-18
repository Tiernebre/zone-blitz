package app.zoneblitz.gamesimulator.output;

import app.zoneblitz.gamesimulator.event.PlayEvent;

/**
 * Immutable accumulator for stats incrementally folded over a {@link PlayEvent} stream. Every
 * {@link #apply(PlayEvent)} returns a new instance; {@link #snapshot()} materializes the current
 * state as a {@link GameStats}.
 */
public interface StatsProjection {

  /**
   * Returns a new projection that has incorporated {@code event}. Never mutates {@code this}.
   *
   * @param event the next play event in sequence; must not be {@code null}
   * @return a new {@link StatsProjection}
   */
  StatsProjection apply(PlayEvent event);

  /** Materializes the current accumulator state as an immutable {@link GameStats}. */
  GameStats snapshot();
}
