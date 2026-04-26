package app.zoneblitz.gamesimulator.resolver.pass;

import app.zoneblitz.gamesimulator.event.PassConcept;
import app.zoneblitz.gamesimulator.formation.CoverageShell;
import app.zoneblitz.gamesimulator.formation.OffensiveFormation;
import app.zoneblitz.gamesimulator.resolver.PassRoles;
import app.zoneblitz.gamesimulator.role.RoleAssignmentPair;
import app.zoneblitz.gamesimulator.scheme.DefensiveScheme;
import app.zoneblitz.gamesimulator.scheme.OffensiveScheme;
import java.util.Objects;

/**
 * Bundle of pre-snap inputs a {@link MatchupPassResolver.PassMatchupShift} consumes.
 *
 * <p>{@code concept} is coach intent — it selects the per-(role, concept) demand entries from each
 * scheme's {@link OffensiveScheme#demandTable()} / {@link DefensiveScheme#demandTable()}, plus the
 * concept-level coverage / pass-rush leg weights. {@code shell} is the defense's sampled coverage
 * call. {@code formation} is carried forward for future shifts that weight beyond shell alone
 * (motion, trips, bunch).
 *
 * <p>{@code assignment} is the fine-grained role-to-player mapping the role-keyed shift consumes to
 * compute per-(role, player) demand scores. {@code roles} is the bucket-flattened view used by
 * pre-existing consumers (target selector, pressure model, interception picker) — it is derived
 * from {@code assignment} via {@link PassRoles#from(RoleAssignmentPair)}.
 */
public record PassMatchupContext(
    PassConcept concept,
    PassRoles roles,
    OffensiveFormation formation,
    CoverageShell shell,
    OffensiveScheme offenseScheme,
    DefensiveScheme defenseScheme,
    RoleAssignmentPair assignment,
    double boxLoadingShift) {

  public PassMatchupContext {
    Objects.requireNonNull(concept, "concept");
    Objects.requireNonNull(roles, "roles");
    Objects.requireNonNull(formation, "formation");
    Objects.requireNonNull(shell, "shell");
    Objects.requireNonNull(offenseScheme, "offenseScheme");
    Objects.requireNonNull(defenseScheme, "defenseScheme");
    Objects.requireNonNull(assignment, "assignment");
  }

  /** Convenience constructor that defaults the box-loading shift to zero. */
  public PassMatchupContext(
      PassConcept concept,
      PassRoles roles,
      OffensiveFormation formation,
      CoverageShell shell,
      OffensiveScheme offenseScheme,
      DefensiveScheme defenseScheme,
      RoleAssignmentPair assignment) {
    this(concept, roles, formation, shell, offenseScheme, defenseScheme, assignment, 0.0);
  }
}
