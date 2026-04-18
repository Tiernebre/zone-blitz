package app.zoneblitz.gamesimulator.roster;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class CoachTendenciesTests {

  @Test
  void average_placesEveryAxisAtFifty() {
    var t = CoachTendencies.average();

    assertThat(t.passHeaviness()).isEqualTo(50);
    assertThat(t.aggression()).isEqualTo(50);
    assertThat(t.playActionAffinity()).isEqualTo(50);
    assertThat(t.screenAffinity()).isEqualTo(50);
    assertThat(t.gapRunPreference()).isEqualTo(50);
    assertThat(t.shotgunPreference()).isEqualTo(50);
  }

  @Test
  void constructor_rejectsAxisBelowZero() {
    assertThatThrownBy(() -> new CoachTendencies(-1, 50, 50, 50, 50, 50, 50, 50, 50, 50))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("passHeaviness");
  }

  @Test
  void constructor_rejectsAxisAboveHundred() {
    assertThatThrownBy(() -> new CoachTendencies(50, 50, 50, 50, 50, 50, 50, 101, 50, 50))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("shotgunPreference");
  }

  @Test
  void defensiveAverage_placesEveryAxisAtFifty() {
    var d = DefensiveCoachTendencies.average();

    assertThat(d.blitzFrequency()).isEqualTo(50);
    assertThat(d.manZoneBias()).isEqualTo(50);
    assertThat(d.coverageShellBias()).isEqualTo(50);
  }

  @Test
  void coachAverage_buildsNeutralCoachWithBothSides() {
    var c = Coach.average(new CoachId(new java.util.UUID(1L, 2L)), "Neutral");

    assertThat(c.offense()).isEqualTo(CoachTendencies.average());
    assertThat(c.defense()).isEqualTo(DefensiveCoachTendencies.average());
  }
}
