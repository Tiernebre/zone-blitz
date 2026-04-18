package app.zoneblitz.gamesimulator.resolver.pass;

import app.zoneblitz.gamesimulator.event.PassConcept;
import app.zoneblitz.gamesimulator.formation.CoverageShell;
import app.zoneblitz.gamesimulator.formation.OffensiveFormation;
import app.zoneblitz.gamesimulator.resolver.PassRoles;
import java.util.Objects;

/**
 * Bundle of pre-snap inputs a {@link MatchupPassResolver.PassMatchupShift} consumes.
 *
 * <p>{@code concept} is coach intent — it selects the {@link PassConceptProfile} that weights the
 * coverage leg vs. the pass-rush leg and the per-axis physical/skill mixes. {@code shell} is the
 * defense's sampled coverage call. {@code formation} is carried forward for future shifts that
 * weight beyond shell alone (motion, trips, bunch).
 */
public record PassMatchupContext(
    PassConcept concept, PassRoles roles, OffensiveFormation formation, CoverageShell shell) {

  public PassMatchupContext {
    Objects.requireNonNull(concept, "concept");
    Objects.requireNonNull(roles, "roles");
    Objects.requireNonNull(formation, "formation");
    Objects.requireNonNull(shell, "shell");
  }
}
