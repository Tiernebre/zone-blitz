package app.zoneblitz.gamesimulator;

import java.util.Objects;
import java.util.UUID;

/** Stable identifier for a player referenced by a {@link PlayEvent}. */
public record PlayerId(UUID value) {
  public PlayerId {
    Objects.requireNonNull(value, "value");
  }
}
