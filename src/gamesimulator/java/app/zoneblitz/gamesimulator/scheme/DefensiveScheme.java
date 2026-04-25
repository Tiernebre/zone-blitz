package app.zoneblitz.gamesimulator.scheme;

import app.zoneblitz.gamesimulator.formation.CoverageShell;
import app.zoneblitz.gamesimulator.personnel.DefensivePackage;
import app.zoneblitz.gamesimulator.role.DefensiveRole;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * The defensive half of a team's scheme. Carries the personnel/coverage/rusher-count distributions
 * the call selector leans on, the per-role demand table the matchup-shift resolver consults, the
 * scheme's role-slot mapping per personnel package, and the {@link DefensiveFront} that anchors the
 * base look.
 *
 * <p>Preference maps carry non-negative finite values; consumers normalize at use-time. Empty maps
 * are legal (the scheme has no opinion on that dimension and falls back to league priors).
 */
public record DefensiveScheme(
    DefensiveSchemeId id,
    DefensiveFront front,
    Map<DefensivePackage, Double> packagePreference,
    Map<CoverageShell, Double> coveragePreference,
    Map<Integer, Double> rushersPreference,
    RoleDemandTable demandTable,
    Map<DefensivePackage, List<DefensiveRole>> roleSlots) {

  public DefensiveScheme {
    Objects.requireNonNull(id, "id");
    Objects.requireNonNull(front, "front");
    Objects.requireNonNull(packagePreference, "packagePreference");
    Objects.requireNonNull(coveragePreference, "coveragePreference");
    Objects.requireNonNull(rushersPreference, "rushersPreference");
    Objects.requireNonNull(demandTable, "demandTable");
    Objects.requireNonNull(roleSlots, "roleSlots");
    requireFiniteNonNegative(packagePreference, "packagePreference");
    requireFiniteNonNegative(coveragePreference, "coveragePreference");
    requireRushersFiniteNonNegative(rushersPreference);
    packagePreference = Map.copyOf(packagePreference);
    coveragePreference = Map.copyOf(coveragePreference);
    rushersPreference = Map.copyOf(rushersPreference);
    roleSlots = copyRoleSlots(roleSlots);
  }

  private static Map<DefensivePackage, List<DefensiveRole>> copyRoleSlots(
      Map<DefensivePackage, List<DefensiveRole>> source) {
    var copy = new java.util.EnumMap<DefensivePackage, List<DefensiveRole>>(DefensivePackage.class);
    for (var entry : source.entrySet()) {
      Objects.requireNonNull(entry.getKey(), "roleSlots key");
      Objects.requireNonNull(entry.getValue(), "roleSlots value");
      copy.put(entry.getKey(), List.copyOf(entry.getValue()));
    }
    return Map.copyOf(copy);
  }

  private static <K> void requireFiniteNonNegative(Map<K, Double> values, String name) {
    for (var entry : values.entrySet()) {
      Objects.requireNonNull(entry.getKey(), name + " key");
      var v = entry.getValue();
      Objects.requireNonNull(v, name + " value");
      if (v < 0.0 || Double.isNaN(v) || Double.isInfinite(v)) {
        throw new IllegalArgumentException(
            name + " values must be finite non-negative numbers, got " + v);
      }
    }
  }

  private static void requireRushersFiniteNonNegative(Map<Integer, Double> values) {
    for (var entry : values.entrySet()) {
      Objects.requireNonNull(entry.getKey(), "rushersPreference key");
      var rushers = entry.getKey();
      if (rushers < 0) {
        throw new IllegalArgumentException(
            "rushersPreference rusher count must be non-negative, got " + rushers);
      }
      var v = entry.getValue();
      Objects.requireNonNull(v, "rushersPreference value");
      if (v < 0.0 || Double.isNaN(v) || Double.isInfinite(v)) {
        throw new IllegalArgumentException(
            "rushersPreference values must be finite non-negative numbers, got " + v);
      }
    }
  }
}
