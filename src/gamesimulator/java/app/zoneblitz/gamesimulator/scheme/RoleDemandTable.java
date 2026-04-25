package app.zoneblitz.gamesimulator.scheme;

import app.zoneblitz.gamesimulator.event.ConceptFamily;
import app.zoneblitz.gamesimulator.role.Role;
import app.zoneblitz.gamesimulator.role.RoleDemand;
import java.util.Map;
import java.util.Objects;

/**
 * Per-scheme catalog of {@link RoleDemand} keyed by {@link Role} and optionally specialized by
 * {@link ConceptFamily}. Lookup checks for a concept-specific override first, then falls back to
 * the role default — so a scheme can encode "an X-WR generally weighs route running and speed,
 * <em>except</em> on screens, where hands and agility matter more."
 *
 * <p>Both maps are defensively copied. Lookup throws when neither an override nor a default exists;
 * that signals a scheme data error and should fail tests loudly rather than producing a silent zero
 * matchup contribution.
 */
public record RoleDemandTable(
    Map<Role, RoleDemand> defaultsByRole, Map<RoleDemandKey, RoleDemand> overridesByKey) {

  public RoleDemandTable {
    Objects.requireNonNull(defaultsByRole, "defaultsByRole");
    Objects.requireNonNull(overridesByKey, "overridesByKey");
    defaultsByRole = Map.copyOf(defaultsByRole);
    overridesByKey = Map.copyOf(overridesByKey);
  }

  public static RoleDemandTable ofDefaults(Map<Role, RoleDemand> defaultsByRole) {
    return new RoleDemandTable(defaultsByRole, Map.of());
  }

  public RoleDemand lookup(Role role, ConceptFamily concept) {
    Objects.requireNonNull(role, "role");
    Objects.requireNonNull(concept, "concept");
    var override = overridesByKey.get(new RoleDemandKey(role, concept));
    if (override != null) {
      return override;
    }
    var fallback = defaultsByRole.get(role);
    if (fallback != null) {
      return fallback;
    }
    throw new IllegalStateException(
        "No RoleDemand registered for role=" + role.code() + " concept=" + concept);
  }
}
