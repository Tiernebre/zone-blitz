package app.zoneblitz.gamesimulator.scheme;

import app.zoneblitz.gamesimulator.event.PassConcept;
import app.zoneblitz.gamesimulator.event.RunConcept;
import app.zoneblitz.gamesimulator.formation.OffensiveFormation;
import app.zoneblitz.gamesimulator.personnel.OffensivePackage;
import app.zoneblitz.gamesimulator.role.OffensiveRole;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * The offensive half of a team's scheme. Carries the personnel/formation/concept distributions the
 * play caller leans on, the per-role demand table the matchup-shift resolver consults, and the
 * scheme's role-slot mapping per personnel grouping (which roles exist when 11-personnel is on the
 * field, vs. 12, vs. JUMBO, etc.).
 *
 * <p>Preference and bias maps carry non-negative finite values; consumers normalize at use-time.
 * Empty maps are legal (the scheme has no opinion on that dimension and falls back to league
 * priors).
 */
public record OffensiveScheme(
    OffensiveSchemeId id,
    Map<OffensivePackage, Double> packagePreference,
    Map<OffensiveFormation, Double> formationPreference,
    Map<PassConcept, Double> passConceptBias,
    Map<RunConcept, Double> runConceptBias,
    RoleDemandTable demandTable,
    Map<OffensivePackage, List<OffensiveRole>> roleSlots) {

  public OffensiveScheme {
    Objects.requireNonNull(id, "id");
    Objects.requireNonNull(packagePreference, "packagePreference");
    Objects.requireNonNull(formationPreference, "formationPreference");
    Objects.requireNonNull(passConceptBias, "passConceptBias");
    Objects.requireNonNull(runConceptBias, "runConceptBias");
    Objects.requireNonNull(demandTable, "demandTable");
    Objects.requireNonNull(roleSlots, "roleSlots");
    requireFiniteNonNegative(packagePreference, "packagePreference");
    requireFiniteNonNegative(formationPreference, "formationPreference");
    requireFiniteNonNegative(passConceptBias, "passConceptBias");
    requireFiniteNonNegative(runConceptBias, "runConceptBias");
    packagePreference = Map.copyOf(packagePreference);
    formationPreference = Map.copyOf(formationPreference);
    passConceptBias = Map.copyOf(passConceptBias);
    runConceptBias = Map.copyOf(runConceptBias);
    roleSlots = copyRoleSlots(roleSlots);
  }

  private static Map<OffensivePackage, List<OffensiveRole>> copyRoleSlots(
      Map<OffensivePackage, List<OffensiveRole>> source) {
    var copy = new java.util.EnumMap<OffensivePackage, List<OffensiveRole>>(OffensivePackage.class);
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
}
