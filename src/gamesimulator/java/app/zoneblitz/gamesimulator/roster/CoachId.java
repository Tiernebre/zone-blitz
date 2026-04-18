package app.zoneblitz.gamesimulator.roster;

import java.util.Objects;
import java.util.UUID;

/** Stable identifier for a coach. */
public record CoachId(UUID value) {
  public CoachId {
    Objects.requireNonNull(value, "value");
  }
}
