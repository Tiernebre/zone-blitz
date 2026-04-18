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
 */
public record RunMatchupContext(RunConcept concept, RunRoles roles, OffensiveFormation formation) {

  public RunMatchupContext {
    Objects.requireNonNull(concept, "concept");
    Objects.requireNonNull(roles, "roles");
    Objects.requireNonNull(formation, "formation");
  }
}
