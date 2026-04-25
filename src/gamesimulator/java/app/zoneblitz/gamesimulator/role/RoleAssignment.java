package app.zoneblitz.gamesimulator.role;

import app.zoneblitz.gamesimulator.roster.Player;
import java.util.Map;
import java.util.Optional;

/**
 * Per-snap mapping from {@link Role} to the {@link Player} taking that role. Sealed across the
 * offense/defense split so the engine never accidentally hands a defensive assignment into an
 * offensive query.
 */
public sealed interface RoleAssignment permits OffensiveRoleAssignment, DefensiveRoleAssignment {

  Map<? extends Role, Player> players();

  /**
   * Returns the player at {@code role} if assigned. The caller treats absent as "this role has no
   * player on this snap" — the matchup-shift loop simply skips such pairs, never throws. Callers
   * doing an exhaustive expectation should assert presence themselves.
   */
  default Optional<Player> playerAt(Role role) {
    return Optional.ofNullable(players().get(role));
  }
}
