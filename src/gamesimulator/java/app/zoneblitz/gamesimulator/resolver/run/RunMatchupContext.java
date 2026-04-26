package app.zoneblitz.gamesimulator.resolver.run;

import app.zoneblitz.gamesimulator.event.RunConcept;
import app.zoneblitz.gamesimulator.formation.OffensiveFormation;
import app.zoneblitz.gamesimulator.resolver.RunRoles;
import app.zoneblitz.gamesimulator.role.RoleAssignmentPair;
import app.zoneblitz.gamesimulator.scheme.DefensiveScheme;
import app.zoneblitz.gamesimulator.scheme.OffensiveScheme;
import java.util.Objects;

/**
 * Bundle of pre-snap inputs a {@link MatchupRunResolver.RunMatchupShift} consumes to compute the
 * run matchup scalar.
 *
 * <p>Lives as a record — not a widening parameter list — so additional context (weather, field
 * zone, score differential) can be added without cascading signature changes through every
 * implementation.
 *
 * <p>{@code yardLine} is the offense's spot measured from their own goal line (0–100); the
 * opponent's goal sits at 100, so {@code yardsToGoal = 100 - yardLine}. {@code yardsToGo} is the
 * current down-and-distance yards-to-go. Both feed situational shifts like {@link
 * GoalLineRunShift}; {@link MatchupRunResolver.RunMatchupShift} implementations that ignore field
 * position simply don't read these fields.
 *
 * <p>{@code assignment} is the fine-grained role-to-player mapping the role-keyed shift consumes to
 * compute per-(role, player) demand scores. {@code roles} is the bucket-flattened view used by the
 * resolver and pre-existing consumers — derived from {@code assignment} via {@link
 * RunRoles#from(RoleAssignmentPair)}.
 */
public record RunMatchupContext(
    RunConcept concept,
    RunRoles roles,
    OffensiveFormation formation,
    int yardLine,
    int yardsToGo,
    OffensiveScheme offenseScheme,
    DefensiveScheme defenseScheme,
    RoleAssignmentPair assignment,
    double boxLoadingShift) {

  public RunMatchupContext {
    Objects.requireNonNull(concept, "concept");
    Objects.requireNonNull(roles, "roles");
    Objects.requireNonNull(formation, "formation");
    Objects.requireNonNull(offenseScheme, "offenseScheme");
    Objects.requireNonNull(defenseScheme, "defenseScheme");
    Objects.requireNonNull(assignment, "assignment");
  }

  /** Convenience constructor for callers that don't yet supply an in-game box-loading shift. */
  public RunMatchupContext(
      RunConcept concept,
      RunRoles roles,
      OffensiveFormation formation,
      int yardLine,
      int yardsToGo,
      OffensiveScheme offenseScheme,
      DefensiveScheme defenseScheme,
      RoleAssignmentPair assignment) {
    this(
        concept,
        roles,
        formation,
        yardLine,
        yardsToGo,
        offenseScheme,
        defenseScheme,
        assignment,
        0.0);
  }

  /** Yards from the offense's current spot to the opponent's goal line. */
  public int yardsToGoal() {
    return 100 - yardLine;
  }
}
