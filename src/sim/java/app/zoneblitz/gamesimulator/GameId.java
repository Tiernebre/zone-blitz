package app.zoneblitz.gamesimulator;

import java.util.Objects;
import java.util.UUID;

/** Stable identifier for a simulated game. Used as a component of the per-snap RNG split key. */
public record GameId(UUID value) {
  public GameId {
    Objects.requireNonNull(value, "value");
  }

  public static GameId random() {
    return new GameId(UUID.randomUUID());
  }
}
