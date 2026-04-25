package app.zoneblitz.gamesimulator.scheme;

import java.util.Objects;

/**
 * A team's resolved scheme — both halves bundled. Computed once per game by {@link SchemeResolver}
 * from the team's coaching staff and threaded through {@code GameInputs} into the sim.
 */
public record ResolvedScheme(OffensiveScheme offense, DefensiveScheme defense) {

  public ResolvedScheme {
    Objects.requireNonNull(offense, "offense");
    Objects.requireNonNull(defense, "defense");
  }
}
