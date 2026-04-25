package app.zoneblitz.gamesimulator.fourthdown;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class StaticFourthDownEvTableTests {

  private final FourthDownEvTable table = new StaticFourthDownEvTable();

  @Test
  void evOptimalGoProbability_deepOwnTerritoryLong_isNearZero() {
    assertThat(table.evOptimalGoProbability(5, 10)).isLessThan(0.05);
  }

  @Test
  void evOptimalGoProbability_midfieldInches_isStrongGo() {
    assertThat(table.evOptimalGoProbability(55, 1)).isGreaterThan(0.8);
  }

  @Test
  void evOptimalGoProbability_midfieldShort_isFavourGo() {
    assertThat(table.evOptimalGoProbability(55, 2)).isGreaterThan(0.5);
  }

  @Test
  void evOptimalGoProbability_fieldGoalFringeLong_isKick() {
    assertThat(table.evOptimalGoProbability(75, 8)).isLessThan(0.1);
  }

  @Test
  void evOptimalGoProbability_goalLineInches_isNearCertainGo() {
    assertThat(table.evOptimalGoProbability(97, 1)).isGreaterThan(0.9);
  }

  @Test
  void evOptimalGoProbability_monotonicallyNonIncreasingWithDistance() {
    for (var yardLine = 15; yardLine <= 95; yardLine += 15) {
      var previous = table.evOptimalGoProbability(yardLine, 1);
      for (var distance = 2; distance <= 15; distance++) {
        var current = table.evOptimalGoProbability(yardLine, distance);
        assertThat(current)
            .as("distance %d at yardLine %d", distance, yardLine)
            .isLessThanOrEqualTo(previous);
        previous = current;
      }
    }
  }

  @Test
  void evOptimalGoProbability_zeroDistance_returnsZero() {
    assertThat(table.evOptimalGoProbability(50, 0)).isEqualTo(0.0);
  }
}
