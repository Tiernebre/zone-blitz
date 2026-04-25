package app.zoneblitz.gamesimulator.role;

import java.util.Objects;

/**
 * Both sides of the per-snap role assignment, the value the {@code RoleAssigner} produces and the
 * matchup-shift resolver consumes.
 */
public record RoleAssignmentPair(OffensiveRoleAssignment offense, DefensiveRoleAssignment defense) {

  public RoleAssignmentPair {
    Objects.requireNonNull(offense, "offense");
    Objects.requireNonNull(defense, "defense");
  }
}
