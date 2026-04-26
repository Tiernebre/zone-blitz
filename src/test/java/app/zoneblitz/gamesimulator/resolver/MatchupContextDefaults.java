package app.zoneblitz.gamesimulator.resolver;

import app.zoneblitz.gamesimulator.role.DefensiveRoleAssignment;
import app.zoneblitz.gamesimulator.role.OffensiveRoleAssignment;
import app.zoneblitz.gamesimulator.role.RoleAssignmentPair;
import app.zoneblitz.gamesimulator.scheme.BuiltinSchemeCatalog;
import app.zoneblitz.gamesimulator.scheme.DefensiveScheme;
import app.zoneblitz.gamesimulator.scheme.DefensiveSchemeId;
import app.zoneblitz.gamesimulator.scheme.OffensiveScheme;
import app.zoneblitz.gamesimulator.scheme.OffensiveSchemeId;
import java.util.Map;

/**
 * Shared scheme + empty role-assignment fixtures for shift tests that don't exercise the
 * scheme-aware path. Every shift test now needs to feed a {@code PassMatchupContext} / {@code
 * RunMatchupContext} that carries an offense scheme, defense scheme, and role assignment; tests
 * focused on situational shifts ({@code BoxCountRunShift}, {@code GoalLineRunShift}, etc.) supply
 * these defaults so the fields exist without dragging the assertion surface into scheme-dependent
 * territory.
 */
public final class MatchupContextDefaults {

  private static final BuiltinSchemeCatalog CATALOG = new BuiltinSchemeCatalog();

  public static final OffensiveScheme OFFENSE = CATALOG.offense(OffensiveSchemeId.WEST_COAST);
  public static final DefensiveScheme DEFENSE = CATALOG.defense(DefensiveSchemeId.COVER_2_PRESS);
  public static final RoleAssignmentPair EMPTY_ASSIGNMENT =
      new RoleAssignmentPair(
          new OffensiveRoleAssignment(Map.of()), new DefensiveRoleAssignment(Map.of()));

  private MatchupContextDefaults() {}
}
