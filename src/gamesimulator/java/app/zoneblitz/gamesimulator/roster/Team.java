package app.zoneblitz.gamesimulator.roster;

import app.zoneblitz.gamesimulator.event.TeamId;
import java.util.List;
import java.util.Objects;

/**
 * A team participating in a simulated game, with its full active roster. Pre-fetched by the caller
 * from the roster feature's public use case; the sim never touches persistence.
 */
public record Team(TeamId id, String displayName, List<Player> roster) {

  public Team {
    Objects.requireNonNull(id, "id");
    Objects.requireNonNull(displayName, "displayName");
    Objects.requireNonNull(roster, "roster");
    roster = List.copyOf(roster);
  }
}
