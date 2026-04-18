package app.zoneblitz.gamesimulator.resolver.pass;

import app.zoneblitz.gamesimulator.formation.CoverageShell;
import app.zoneblitz.gamesimulator.formation.OffensiveFormation;
import app.zoneblitz.gamesimulator.resolver.PassRoles;
import java.util.Objects;

/**
 * Bundle of pre-snap inputs a {@link MatchupPassResolver.PassMatchupShift} consumes.
 *
 * <p>{@code shell} is the defense's sampled coverage call — the key axis for concept-vs-shell fit
 * once pass concepts arrive. {@code formation} is carried forward for future shifts that weight
 * beyond shell alone (motion, trips, bunch).
 */
public record PassMatchupContext(
    PassRoles roles, OffensiveFormation formation, CoverageShell shell) {

  public PassMatchupContext {
    Objects.requireNonNull(roles, "roles");
    Objects.requireNonNull(formation, "formation");
    Objects.requireNonNull(shell, "shell");
  }
}
