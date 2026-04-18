package app.zoneblitz.gamesimulator.resolver.run;

import app.zoneblitz.gamesimulator.event.RunConcept;
import app.zoneblitz.gamesimulator.formation.OffensiveFormation;
import app.zoneblitz.gamesimulator.resolver.RunRoles;
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
 */
public record RunMatchupContext(
    RunConcept concept, RunRoles roles, OffensiveFormation formation, int yardLine, int yardsToGo) {

  public RunMatchupContext {
    Objects.requireNonNull(concept, "concept");
    Objects.requireNonNull(roles, "roles");
    Objects.requireNonNull(formation, "formation");
  }

  /**
   * Convenience constructor for call sites that don't care about field position (legacy tests,
   * matchup-only shifts). Defaults to midfield ({@code yardLine = 50}) and a standard {@code
   * yardsToGo = 10}.
   */
  public RunMatchupContext(RunConcept concept, RunRoles roles, OffensiveFormation formation) {
    this(concept, roles, formation, 50, 10);
  }

  /** Yards from the offense's current spot to the opponent's goal line. */
  public int yardsToGoal() {
    return 100 - yardLine;
  }
}
