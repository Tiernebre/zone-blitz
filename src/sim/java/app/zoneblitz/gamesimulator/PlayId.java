package app.zoneblitz.gamesimulator;

import java.util.Objects;
import java.util.UUID;

/** Stable identifier for a single play within a simulated game. */
public record PlayId(UUID value) {
  public PlayId {
    Objects.requireNonNull(value, "value");
  }

  public static PlayId random() {
    return new PlayId(UUID.randomUUID());
  }
}
