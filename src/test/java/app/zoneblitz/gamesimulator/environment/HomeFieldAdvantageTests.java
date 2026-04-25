package app.zoneblitz.gamesimulator.environment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class HomeFieldAdvantageTests {

  @Test
  void neutral_hasZeroStrength() {
    assertThat(HomeFieldAdvantage.neutral().strength()).isZero();
  }

  @Test
  void leagueAverage_hasStrengthFifty() {
    assertThat(HomeFieldAdvantage.leagueAverage().strength())
        .isEqualTo(HomeFieldAdvantage.LEAGUE_AVERAGE);
  }

  @Test
  void strength_belowZero_rejected() {
    assertThatThrownBy(() -> new HomeFieldAdvantage(-1))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void strength_aboveHundred_rejected() {
    assertThatThrownBy(() -> new HomeFieldAdvantage(101))
        .isInstanceOf(IllegalArgumentException.class);
  }
}
