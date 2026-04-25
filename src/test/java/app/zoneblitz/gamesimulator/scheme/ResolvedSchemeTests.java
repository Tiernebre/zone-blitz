package app.zoneblitz.gamesimulator.scheme;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Map;
import org.junit.jupiter.api.Test;

class ResolvedSchemeTests {

  private static final RoleDemandTable EMPTY_TABLE = RoleDemandTable.ofDefaults(Map.of());

  @Test
  void constructor_holdsBothHalves() {
    var off =
        new OffensiveScheme(
            OffensiveSchemeId.WEST_COAST,
            Map.of(),
            Map.of(),
            Map.of(),
            Map.of(),
            EMPTY_TABLE,
            Map.of());
    var def =
        new DefensiveScheme(
            DefensiveSchemeId.COVER_3_MATCH,
            DefensiveFront.MULTIPLE,
            Map.of(),
            Map.of(),
            Map.of(),
            EMPTY_TABLE,
            Map.of());

    var resolved = new ResolvedScheme(off, def);

    assertThat(resolved.offense()).isSameAs(off);
    assertThat(resolved.defense()).isSameAs(def);
  }

  @Test
  void constructor_rejectsNullSides() {
    var def =
        new DefensiveScheme(
            DefensiveSchemeId.COVER_3_MATCH,
            DefensiveFront.MULTIPLE,
            Map.of(),
            Map.of(),
            Map.of(),
            EMPTY_TABLE,
            Map.of());

    assertThatThrownBy(() -> new ResolvedScheme(null, def))
        .isInstanceOf(NullPointerException.class)
        .hasMessageContaining("offense");
  }
}
