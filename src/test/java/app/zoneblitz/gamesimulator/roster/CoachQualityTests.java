package app.zoneblitz.gamesimulator.roster;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class CoachQualityTests {

  @Test
  void average_placesEveryAxisAtFifty() {
    var q = CoachQuality.average();

    assertThat(q.decisionQuality()).isEqualTo(50);
    assertThat(q.preparation()).isEqualTo(50);
  }

  @Test
  void constructor_rejectsDecisionQualityBelowZero() {
    assertThatThrownBy(() -> new CoachQuality(-1, 50))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("decisionQuality");
  }

  @Test
  void constructor_rejectsDecisionQualityAboveHundred() {
    assertThatThrownBy(() -> new CoachQuality(101, 50))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("decisionQuality");
  }

  @Test
  void constructor_rejectsPreparationBelowZero() {
    assertThatThrownBy(() -> new CoachQuality(50, -1))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("preparation");
  }

  @Test
  void constructor_rejectsPreparationAboveHundred() {
    assertThatThrownBy(() -> new CoachQuality(50, 101))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("preparation");
  }
}
