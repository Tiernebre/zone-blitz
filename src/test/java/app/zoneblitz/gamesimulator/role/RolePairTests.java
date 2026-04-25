package app.zoneblitz.gamesimulator.role;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class RolePairTests {

  @Test
  void of_buildsBaselineWeightOne() {
    var pair = RolePair.of(OffensiveRole.X_WR, DefensiveRole.OUTSIDE_CB);

    assertThat(pair.weight()).isEqualTo(1.0);
    assertThat(pair.offense()).isEqualTo(OffensiveRole.X_WR);
    assertThat(pair.defense()).isEqualTo(DefensiveRole.OUTSIDE_CB);
  }

  @Test
  void constructor_acceptsZeroWeight() {
    var pair = new RolePair(OffensiveRole.SLOT_WR, DefensiveRole.SLOT_CB, 0.0);

    assertThat(pair.weight()).isZero();
  }

  @Test
  void constructor_rejectsNegativeWeight() {
    assertThatThrownBy(() -> new RolePair(OffensiveRole.X_WR, DefensiveRole.OUTSIDE_CB, -0.1))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("non-negative");
  }

  @Test
  void constructor_rejectsNonFiniteWeight() {
    assertThatThrownBy(() -> new RolePair(OffensiveRole.X_WR, DefensiveRole.OUTSIDE_CB, Double.NaN))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(
            () ->
                new RolePair(
                    OffensiveRole.X_WR, DefensiveRole.OUTSIDE_CB, Double.POSITIVE_INFINITY))
        .isInstanceOf(IllegalArgumentException.class);
  }
}
