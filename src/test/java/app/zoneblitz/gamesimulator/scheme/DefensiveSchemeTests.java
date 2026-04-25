package app.zoneblitz.gamesimulator.scheme;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.zoneblitz.gamesimulator.formation.CoverageShell;
import app.zoneblitz.gamesimulator.personnel.DefensivePackage;
import java.util.Map;
import org.junit.jupiter.api.Test;

class DefensiveSchemeTests {

  private static final RoleDemandTable EMPTY_TABLE = RoleDemandTable.ofDefaults(Map.of());

  @Test
  void constructor_acceptsEmptyPreferenceMaps() {
    var scheme =
        new DefensiveScheme(
            DefensiveSchemeId.COVER_3_MATCH,
            DefensiveFront.MULTIPLE,
            Map.of(),
            Map.of(),
            Map.of(),
            EMPTY_TABLE,
            Map.of());

    assertThat(scheme.front()).isEqualTo(DefensiveFront.MULTIPLE);
    assertThat(scheme.coveragePreference()).isEmpty();
  }

  @Test
  void constructor_rejectsNegativeRusherCount() {
    assertThatThrownBy(
            () ->
                new DefensiveScheme(
                    DefensiveSchemeId.BUDDY_RYAN_46,
                    DefensiveFront.FOUR_THREE,
                    Map.of(),
                    Map.of(),
                    Map.of(-1, 0.2),
                    EMPTY_TABLE,
                    Map.of()))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("rushersPreference");
  }

  @Test
  void constructor_carriesPreferencesAndFront() {
    var scheme =
        new DefensiveScheme(
            DefensiveSchemeId.FANGIO_LIGHT_BOX,
            DefensiveFront.MULTIPLE,
            Map.of(DefensivePackage.NICKEL_425, 0.6, DefensivePackage.DIME_416, 0.3),
            Map.of(CoverageShell.QUARTERS, 0.45, CoverageShell.COVER_3, 0.3),
            Map.of(4, 0.7, 5, 0.2, 6, 0.1),
            EMPTY_TABLE,
            Map.of());

    assertThat(scheme.front()).isEqualTo(DefensiveFront.MULTIPLE);
    assertThat(scheme.packagePreference().get(DefensivePackage.NICKEL_425)).isEqualTo(0.6);
    assertThat(scheme.coveragePreference().get(CoverageShell.QUARTERS)).isEqualTo(0.45);
    assertThat(scheme.rushersPreference().get(4)).isEqualTo(0.7);
  }

  @Test
  void constructor_rejectsNullFront() {
    assertThatThrownBy(
            () ->
                new DefensiveScheme(
                    DefensiveSchemeId.TAMPA_2,
                    null,
                    Map.of(),
                    Map.of(),
                    Map.of(),
                    EMPTY_TABLE,
                    Map.of()))
        .isInstanceOf(NullPointerException.class)
        .hasMessageContaining("front");
  }
}
