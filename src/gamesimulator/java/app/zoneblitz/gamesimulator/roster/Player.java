package app.zoneblitz.gamesimulator.roster;

import app.zoneblitz.gamesimulator.event.PlayerId;
import java.util.Objects;

/**
 * A player participating in a simulated game. Pre-fetched by the caller from the roster feature's
 * public use case; the sim never touches persistence. Carries only the fields resolvers actually
 * consume — attribute families (physical, skill, tendencies) will be added alongside the
 * matchup-aware resolvers that need them.
 */
public record Player(PlayerId id, Position position, String displayName) {

  public Player {
    Objects.requireNonNull(id, "id");
    Objects.requireNonNull(position, "position");
    Objects.requireNonNull(displayName, "displayName");
  }
}
