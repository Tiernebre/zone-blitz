package app.zoneblitz.gamesimulator.scheme;

import app.zoneblitz.gamesimulator.role.Role;
import app.zoneblitz.gamesimulator.role.RoleDemand;
import java.util.HashMap;
import java.util.Map;

/**
 * Default per-role attribute demand vectors. Scheme-agnostic baselines: the questions a generic
 * football coach asks of a body playing this role. Schemes can override any role by populating
 * their {@code RoleDemandTable}; absent overrides, this library is the fallback.
 *
 * <p>Used by Phase 8 scouting (so {@code EvaluateSchemeFit} has demand data even before per-scheme
 * tables are calibrated) and by future matchup-math fallbacks. Per-side data lives in {@link
 * OffensiveRoleDemands} and {@link DefensiveRoleDemands} to keep this file under the 500-LOC
 * ceiling.
 */
public final class DefaultRoleDemands {

  private static final Map<Role, RoleDemand> BY_ROLE = build();

  private DefaultRoleDemands() {}

  public static RoleDemand forRole(Role role) {
    var demand = BY_ROLE.get(role);
    if (demand == null) {
      throw new IllegalStateException("No default demand registered for role " + role.code());
    }
    return demand;
  }

  public static Map<Role, RoleDemand> all() {
    return BY_ROLE;
  }

  private static Map<Role, RoleDemand> build() {
    var map = new HashMap<Role, RoleDemand>();
    OffensiveRoleDemands.contributeTo(map);
    DefensiveRoleDemands.contributeTo(map);
    return Map.copyOf(map);
  }
}
