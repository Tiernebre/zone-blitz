package app.zoneblitz.gamesimulator.role;

import app.zoneblitz.gamesimulator.roster.Player;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/**
 * Concrete offensive role-to-player mapping. Defensive copy at construction so callers cannot
 * mutate the assignment after the fact.
 */
public record OffensiveRoleAssignment(Map<OffensiveRole, Player> players)
    implements RoleAssignment {

  public OffensiveRoleAssignment {
    Objects.requireNonNull(players, "players");
    players = Map.copyOf(players);
  }

  public Optional<Player> at(OffensiveRole role) {
    return Optional.ofNullable(players.get(role));
  }
}
