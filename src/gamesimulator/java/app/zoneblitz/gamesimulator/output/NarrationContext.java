package app.zoneblitz.gamesimulator.output;

import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.Side;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Function;

/**
 * Lookups a {@link PlayNarrator} needs to turn ID-only {@link
 * app.zoneblitz.gamesimulator.event.PlayEvent} records into readable text.
 *
 * <p>Events reference {@link PlayerId} and {@link Side} rather than names so that the event stream
 * stays small, stable, and resilient to player renames / trades. The context resolves those IDs
 * into display names at render time.
 *
 * @param playerName resolver for a player's display name (typically last name). Returns {@link
 *     Optional#empty()} when the id is unknown; callers fall back to a stable placeholder.
 * @param teamName resolver for a team's short display name for a given game side. Must return a
 *     non-blank string for both {@link Side#HOME} and {@link Side#AWAY}.
 */
public record NarrationContext(
    Function<PlayerId, Optional<String>> playerName, Function<Side, String> teamName) {

  public NarrationContext {
    Objects.requireNonNull(playerName, "playerName");
    Objects.requireNonNull(teamName, "teamName");
  }

  /**
   * Look up a player's display name, falling back to {@code "unknown"} if the id is {@code null} or
   * unresolved.
   */
  public String nameOf(PlayerId id) {
    if (id == null) {
      return "unknown";
    }
    return playerName.apply(id).filter(name -> !name.isBlank()).orElse("unknown");
  }

  /** Look up a team's display name for the given side. */
  public String nameOf(Side side) {
    Objects.requireNonNull(side, "side");
    return teamName.apply(side);
  }
}
