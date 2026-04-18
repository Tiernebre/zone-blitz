package app.zoneblitz.gamesimulator.event;

import java.util.Objects;
import java.util.UUID;

/** Stable identifier for a team participating in a simulated game. */
public record TeamId(UUID value) {
  public TeamId {
    Objects.requireNonNull(value, "value");
  }
}
