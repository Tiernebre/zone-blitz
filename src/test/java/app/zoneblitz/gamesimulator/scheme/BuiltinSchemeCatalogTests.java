package app.zoneblitz.gamesimulator.scheme;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

class BuiltinSchemeCatalogTests {

  private final BuiltinSchemeCatalog catalog = new BuiltinSchemeCatalog();

  @ParameterizedTest
  @EnumSource(OffensiveSchemeId.class)
  void offense_returnsRecordForEveryId(OffensiveSchemeId id) {
    var scheme = catalog.offense(id);

    assertThat(scheme.id()).isEqualTo(id);
  }

  @ParameterizedTest
  @EnumSource(DefensiveSchemeId.class)
  void defense_returnsRecordForEveryId(DefensiveSchemeId id) {
    var scheme = catalog.defense(id);

    assertThat(scheme.id()).isEqualTo(id);
    assertThat(scheme.front()).isNotNull();
  }

  @Test
  void offense_throwsOnNullId() {
    assertThatThrownBy(() -> catalog.offense(null)).isInstanceOf(NullPointerException.class);
  }
}
