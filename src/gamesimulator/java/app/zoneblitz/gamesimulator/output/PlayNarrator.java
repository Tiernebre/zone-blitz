package app.zoneblitz.gamesimulator.output;

import app.zoneblitz.gamesimulator.event.PlayEvent;

/**
 * Formats a {@link PlayEvent} into a human-readable play-by-play string using the supplied {@link
 * NarrationContext} for name and team lookups. Implementations are pure functions: the same event
 * plus the same context must always produce the same string. No RNG, no I/O, no mutable state.
 *
 * <p>Narration is intentionally a separate layer from the simulation engine so that multiple
 * narration styles (terse, ESPN-style, radio-verbose) and localizations can be layered on top of a
 * single event stream.
 */
public interface PlayNarrator {

  /**
   * Narrate a single play event.
   *
   * @param event the event emitted by the simulation engine; must not be {@code null}.
   * @param context lookups for player names and team identities; must not be {@code null}.
   * @return a concise, present-tense English description of the play. Never {@code null} or blank.
   * @throws NullPointerException if {@code event} or {@code context} is {@code null}.
   */
  String narrate(PlayEvent event, NarrationContext context);

  /** Returns the default, style-neutral implementation. */
  static PlayNarrator defaultNarrator() {
    return new DefaultPlayNarrator();
  }
}
