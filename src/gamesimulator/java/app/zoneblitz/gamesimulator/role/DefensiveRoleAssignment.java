package app.zoneblitz.gamesimulator.role;

import app.zoneblitz.gamesimulator.roster.Player;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/**
 * Concrete defensive role-to-player mapping. Defensive copy at construction so callers cannot
 * mutate the assignment after the fact.
 */
public record DefensiveRoleAssignment(Map<DefensiveRole, Player> players)
    implements RoleAssignment {

  public DefensiveRoleAssignment {
    Objects.requireNonNull(players, "players");
    players = Map.copyOf(players);
  }

  public Optional<Player> at(DefensiveRole role) {
    return Optional.ofNullable(players.get(role));
  }
}
