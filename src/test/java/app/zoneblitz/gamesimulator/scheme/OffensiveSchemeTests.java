package app.zoneblitz.gamesimulator.scheme;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.zoneblitz.gamesimulator.event.PassConcept;
import app.zoneblitz.gamesimulator.event.RunConcept;
import app.zoneblitz.gamesimulator.formation.OffensiveFormation;
import app.zoneblitz.gamesimulator.personnel.OffensivePackage;
import app.zoneblitz.gamesimulator.role.OffensiveRole;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class OffensiveSchemeTests {

  private static final RoleDemandTable EMPTY_TABLE = RoleDemandTable.ofDefaults(Map.of());

  @Test
  void constructor_acceptsEmptyPreferenceMaps() {
    var scheme =
        new OffensiveScheme(
            OffensiveSchemeId.WEST_COAST,
            Map.of(),
            Map.of(),
            Map.of(),
            Map.of(),
            EMPTY_TABLE,
            Map.of());

    assertThat(scheme.id()).isEqualTo(OffensiveSchemeId.WEST_COAST);
    assertThat(scheme.packagePreference()).isEmpty();
  }

  @Test
  void constructor_rejectsNegativeProbability() {
    assertThatThrownBy(
            () ->
                new OffensiveScheme(
                    OffensiveSchemeId.AIR_RAID,
                    Map.of(OffensivePackage.P_11, -0.1),
                    Map.of(),
                    Map.of(),
                    Map.of(),
                    EMPTY_TABLE,
                    Map.of()))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("packagePreference");
  }

  @Test
  void constructor_rejectsNonFiniteBias() {
    assertThatThrownBy(
            () ->
                new OffensiveScheme(
                    OffensiveSchemeId.AIR_RAID,
                    Map.of(),
                    Map.of(),
                    Map.of(PassConcept.HAIL_MARY, Double.POSITIVE_INFINITY),
                    Map.of(),
                    EMPTY_TABLE,
                    Map.of()))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void constructor_copiesNestedRoleSlotLists() {
    var slots = new java.util.HashMap<OffensivePackage, List<OffensiveRole>>();
    var mutableList = new java.util.ArrayList<OffensiveRole>();
    mutableList.add(OffensiveRole.X_WR);
    slots.put(OffensivePackage.P_11, mutableList);

    var scheme =
        new OffensiveScheme(
            OffensiveSchemeId.AIR_RAID, Map.of(), Map.of(), Map.of(), Map.of(), EMPTY_TABLE, slots);

    mutableList.add(OffensiveRole.SLOT_WR);
    slots.clear();

    assertThat(scheme.roleSlots()).containsOnlyKeys(OffensivePackage.P_11);
    assertThat(scheme.roleSlots().get(OffensivePackage.P_11)).containsExactly(OffensiveRole.X_WR);
  }

  @Test
  void constructor_carriesPreferenceMapsThrough() {
    var scheme =
        new OffensiveScheme(
            OffensiveSchemeId.SMASHMOUTH,
            Map.of(OffensivePackage.P_21, 0.55, OffensivePackage.P_22, 0.30),
            Map.of(OffensiveFormation.I_FORM, 0.7, OffensiveFormation.SINGLEBACK, 0.3),
            Map.of(PassConcept.PLAY_ACTION, 1.4, PassConcept.SCREEN, 0.4),
            Map.of(RunConcept.POWER, 1.5, RunConcept.COUNTER, 1.3),
            EMPTY_TABLE,
            Map.of());

    assertThat(scheme.packagePreference()).hasSize(2);
    assertThat(scheme.formationPreference().get(OffensiveFormation.I_FORM)).isEqualTo(0.7);
    assertThat(scheme.passConceptBias().get(PassConcept.PLAY_ACTION)).isEqualTo(1.4);
    assertThat(scheme.runConceptBias().get(RunConcept.POWER)).isEqualTo(1.5);
  }
}
