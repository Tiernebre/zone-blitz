package app.zoneblitz.gamesimulator.scheme;

import app.zoneblitz.gamesimulator.event.PassConcept;
import app.zoneblitz.gamesimulator.event.RunConcept;
import app.zoneblitz.gamesimulator.formation.CoverageShell;
import app.zoneblitz.gamesimulator.formation.OffensiveFormation;
import app.zoneblitz.gamesimulator.personnel.DefensivePackage;
import app.zoneblitz.gamesimulator.personnel.OffensivePackage;
import java.util.EnumMap;
import java.util.Map;
import java.util.Objects;

/**
 * Hardcoded {@link SchemeCatalog} with hand-tuned distinctive bias data per scheme. AIR_RAID skews
 * pass-heavy with empty/spread personnel; SMASHMOUTH skews run-heavy with two-back / extra-tight
 * personnel; FANGIO_LIGHT_BOX prefers two-high quarters with sub packages; BUDDY_RYAN_46 piles
 * extra rushers and plays man-cover-1.
 *
 * <p>Every scheme shares the same {@link LegacyConceptDemands} table — the per-(role, concept)
 * overrides translated from the legacy bucket-keyed concept profiles, so the role-keyed matchup
 * shifts reproduce the legacy aggregation exactly. The table holds no role-default entries, so
 * scouting still falls back to {@link DefaultRoleDemands} for general scheme-fit scoring.
 * Per-scheme demand variance lands in a follow-up calibration phase.
 */
public final class BuiltinSchemeCatalog implements SchemeCatalog {

  private final Map<OffensiveSchemeId, OffensiveScheme> offenseById;
  private final Map<DefensiveSchemeId, DefensiveScheme> defenseById;

  public BuiltinSchemeCatalog() {
    this.offenseById = buildOffense();
    this.defenseById = buildDefense();
  }

  @Override
  public OffensiveScheme offense(OffensiveSchemeId id) {
    var scheme = offenseById.get(Objects.requireNonNull(id, "id"));
    if (scheme == null) {
      throw new IllegalArgumentException("No OffensiveScheme registered for " + id);
    }
    return scheme;
  }

  @Override
  public DefensiveScheme defense(DefensiveSchemeId id) {
    var scheme = defenseById.get(Objects.requireNonNull(id, "id"));
    if (scheme == null) {
      throw new IllegalArgumentException("No DefensiveScheme registered for " + id);
    }
    return scheme;
  }

  private static Map<OffensiveSchemeId, OffensiveScheme> buildOffense() {
    var map = new EnumMap<OffensiveSchemeId, OffensiveScheme>(OffensiveSchemeId.class);
    var sharedTable = LegacyConceptDemands.table();

    map.put(
        OffensiveSchemeId.WEST_COAST,
        new OffensiveScheme(
            OffensiveSchemeId.WEST_COAST,
            Map.of(
                OffensivePackage.P_11, 0.55,
                OffensivePackage.P_12, 0.25,
                OffensivePackage.P_21, 0.15),
            Map.of(
                OffensiveFormation.SHOTGUN, 0.45,
                OffensiveFormation.SINGLEBACK, 0.30,
                OffensiveFormation.PISTOL, 0.15),
            Map.of(
                PassConcept.QUICK_GAME, 1.4,
                PassConcept.DROPBACK, 1.1,
                PassConcept.SCREEN, 1.2,
                PassConcept.PLAY_ACTION, 0.9),
            Map.of(RunConcept.OUTSIDE_ZONE, 1.2, RunConcept.INSIDE_ZONE, 1.1),
            sharedTable,
            Map.of()));

    map.put(
        OffensiveSchemeId.AIR_RAID,
        new OffensiveScheme(
            OffensiveSchemeId.AIR_RAID,
            Map.of(
                OffensivePackage.P_10, 0.50,
                OffensivePackage.P_00, 0.30,
                OffensivePackage.P_11, 0.20),
            Map.of(OffensiveFormation.SHOTGUN, 0.70, OffensiveFormation.EMPTY, 0.25),
            Map.of(
                PassConcept.DROPBACK, 1.4,
                PassConcept.QUICK_GAME, 1.3,
                PassConcept.HAIL_MARY, 1.5,
                PassConcept.PLAY_ACTION, 0.7),
            Map.of(RunConcept.QB_DRAW, 1.4, RunConcept.DRAW, 1.2),
            sharedTable,
            Map.of()));

    map.put(
        OffensiveSchemeId.SPREAD_OPTION,
        new OffensiveScheme(
            OffensiveSchemeId.SPREAD_OPTION,
            Map.of(OffensivePackage.P_11, 0.55, OffensivePackage.P_10, 0.30),
            Map.of(OffensiveFormation.SHOTGUN, 0.65, OffensiveFormation.PISTOL, 0.25),
            Map.of(
                PassConcept.RPO, 1.6,
                PassConcept.QUICK_GAME, 1.2,
                PassConcept.DROPBACK, 1.0),
            Map.of(
                RunConcept.OUTSIDE_ZONE, 1.3,
                RunConcept.QB_DRAW, 1.4,
                RunConcept.INSIDE_ZONE, 1.1),
            sharedTable,
            Map.of()));

    map.put(
        OffensiveSchemeId.SMASHMOUTH,
        new OffensiveScheme(
            OffensiveSchemeId.SMASHMOUTH,
            Map.of(
                OffensivePackage.P_21, 0.40,
                OffensivePackage.P_22, 0.25,
                OffensivePackage.P_12, 0.20,
                OffensivePackage.JUMBO_6OL_22, 0.15),
            Map.of(
                OffensiveFormation.I_FORM, 0.45,
                OffensiveFormation.SINGLEBACK, 0.35,
                OffensiveFormation.JUMBO, 0.15),
            Map.of(
                PassConcept.PLAY_ACTION, 1.5,
                PassConcept.DROPBACK, 0.8,
                PassConcept.QUICK_GAME, 0.7),
            Map.of(
                RunConcept.POWER, 1.6,
                RunConcept.COUNTER, 1.4,
                RunConcept.TRAP, 1.3,
                RunConcept.SWEEP, 1.1),
            sharedTable,
            Map.of()));

    map.put(
        OffensiveSchemeId.MCVAY_WIDE_ZONE,
        new OffensiveScheme(
            OffensiveSchemeId.MCVAY_WIDE_ZONE,
            Map.of(
                OffensivePackage.P_11, 0.65,
                OffensivePackage.P_12, 0.25,
                OffensivePackage.P_21, 0.10),
            Map.of(
                OffensiveFormation.SINGLEBACK, 0.45,
                OffensiveFormation.SHOTGUN, 0.35,
                OffensiveFormation.PISTOL, 0.15),
            Map.of(
                PassConcept.PLAY_ACTION, 1.5,
                PassConcept.DROPBACK, 1.0,
                PassConcept.QUICK_GAME, 1.0),
            Map.of(RunConcept.OUTSIDE_ZONE, 1.5, RunConcept.INSIDE_ZONE, 1.2),
            sharedTable,
            Map.of()));

    map.put(
        OffensiveSchemeId.ERHARDT_PERKINS,
        new OffensiveScheme(
            OffensiveSchemeId.ERHARDT_PERKINS,
            Map.of(
                OffensivePackage.P_11, 0.45,
                OffensivePackage.P_12, 0.30,
                OffensivePackage.P_21, 0.15),
            Map.of(
                OffensiveFormation.SINGLEBACK, 0.40,
                OffensiveFormation.SHOTGUN, 0.40,
                OffensiveFormation.I_FORM, 0.15),
            Map.of(
                PassConcept.DROPBACK, 1.1,
                PassConcept.QUICK_GAME, 1.0,
                PassConcept.PLAY_ACTION, 1.1,
                PassConcept.SCREEN, 1.0),
            Map.of(
                RunConcept.INSIDE_ZONE, 1.1,
                RunConcept.POWER, 1.1,
                RunConcept.COUNTER, 1.0),
            sharedTable,
            Map.of()));

    return Map.copyOf(map);
  }

  private static Map<DefensiveSchemeId, DefensiveScheme> buildDefense() {
    var map = new EnumMap<DefensiveSchemeId, DefensiveScheme>(DefensiveSchemeId.class);
    var sharedTable = LegacyConceptDemands.table();

    map.put(
        DefensiveSchemeId.COVER_2_PRESS,
        new DefensiveScheme(
            DefensiveSchemeId.COVER_2_PRESS,
            DefensiveFront.FOUR_THREE,
            Map.of(DefensivePackage.NICKEL_425, 0.55, DefensivePackage.BASE_43, 0.35),
            Map.of(
                CoverageShell.COVER_2, 0.50,
                CoverageShell.TWO_MAN, 0.20,
                CoverageShell.COVER_3, 0.15),
            Map.of(4, 0.75, 5, 0.20, 3, 0.05),
            sharedTable,
            Map.of()));

    map.put(
        DefensiveSchemeId.COVER_3_MATCH,
        new DefensiveScheme(
            DefensiveSchemeId.COVER_3_MATCH,
            DefensiveFront.MULTIPLE,
            Map.of(
                DefensivePackage.NICKEL_425, 0.55,
                DefensivePackage.BASE_43, 0.30,
                DefensivePackage.DIME_416, 0.10),
            Map.of(
                CoverageShell.COVER_3, 0.55,
                CoverageShell.QUARTERS, 0.15,
                CoverageShell.COVER_1, 0.15),
            Map.of(4, 0.70, 5, 0.20, 3, 0.10),
            sharedTable,
            Map.of()));

    map.put(
        DefensiveSchemeId.COVER_6_QUARTERS,
        new DefensiveScheme(
            DefensiveSchemeId.COVER_6_QUARTERS,
            DefensiveFront.MULTIPLE,
            Map.of(
                DefensivePackage.NICKEL_425, 0.50,
                DefensivePackage.DIME_416, 0.25,
                DefensivePackage.BASE_43, 0.20),
            Map.of(
                CoverageShell.QUARTERS, 0.40,
                CoverageShell.COVER_6, 0.30,
                CoverageShell.COVER_3, 0.15),
            Map.of(4, 0.80, 3, 0.15, 5, 0.05),
            sharedTable,
            Map.of()));

    map.put(
        DefensiveSchemeId.FANGIO_LIGHT_BOX,
        new DefensiveScheme(
            DefensiveSchemeId.FANGIO_LIGHT_BOX,
            DefensiveFront.MULTIPLE,
            Map.of(
                DefensivePackage.NICKEL_425, 0.45,
                DefensivePackage.DIME_416, 0.30,
                DefensivePackage.BASE_34, 0.20),
            Map.of(
                CoverageShell.QUARTERS, 0.40,
                CoverageShell.COVER_6, 0.25,
                CoverageShell.COVER_2, 0.15),
            Map.of(4, 0.75, 3, 0.20, 5, 0.05),
            sharedTable,
            Map.of()));

    map.put(
        DefensiveSchemeId.BUDDY_RYAN_46,
        new DefensiveScheme(
            DefensiveSchemeId.BUDDY_RYAN_46,
            DefensiveFront.FOUR_THREE,
            Map.of(
                DefensivePackage.BASE_43, 0.55,
                DefensivePackage.GOAL_LINE_641, 0.10,
                DefensivePackage.NICKEL_425, 0.30),
            Map.of(
                CoverageShell.COVER_1, 0.40,
                CoverageShell.COVER_0, 0.20,
                CoverageShell.COVER_3, 0.20),
            Map.of(5, 0.45, 6, 0.25, 4, 0.25, 7, 0.05),
            sharedTable,
            Map.of()));

    map.put(
        DefensiveSchemeId.TAMPA_2,
        new DefensiveScheme(
            DefensiveSchemeId.TAMPA_2,
            DefensiveFront.FOUR_THREE,
            Map.of(DefensivePackage.BASE_43, 0.55, DefensivePackage.NICKEL_425, 0.35),
            Map.of(
                CoverageShell.COVER_2, 0.55,
                CoverageShell.COVER_3, 0.20,
                CoverageShell.TWO_MAN, 0.10),
            Map.of(4, 0.85, 3, 0.10, 5, 0.05),
            sharedTable,
            Map.of()));

    return Map.copyOf(map);
  }
}
