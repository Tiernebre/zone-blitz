package app.zoneblitz.gamesimulator.adjustments;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import org.junit.jupiter.api.Test;

class AdaptabilityGateTests {

  @Test
  void factor_atFifty_returnsNeutralOne() {
    assertThat(AdaptabilityGate.factor(50)).isEqualTo(1.0);
  }

  @Test
  void factor_atZero_returnsStubbornFactor() {
    assertThat(AdaptabilityGate.factor(0)).isEqualTo(AdaptabilityGate.STUBBORN_FACTOR);
  }

  @Test
  void factor_atHundred_returnsReactiveFactor() {
    assertThat(AdaptabilityGate.factor(100)).isEqualTo(AdaptabilityGate.REACTIVE_FACTOR);
  }

  @Test
  void factor_belowFifty_interpolatesLinearly() {
    var midLow = AdaptabilityGate.factor(25);
    var expected =
        AdaptabilityGate.STUBBORN_FACTOR
            + 0.5 * (AdaptabilityGate.NEUTRAL_FACTOR - AdaptabilityGate.STUBBORN_FACTOR);

    assertThat(midLow).isCloseTo(expected, within(1e-9));
  }

  @Test
  void factor_outOfRange_clampsToBounds() {
    assertThat(AdaptabilityGate.factor(-10)).isEqualTo(AdaptabilityGate.STUBBORN_FACTOR);
    assertThat(AdaptabilityGate.factor(120)).isEqualTo(AdaptabilityGate.REACTIVE_FACTOR);
  }

  @Test
  void scaleMultiplier_neutralGate_returnsInputUnchanged() {
    assertThat(AdaptabilityGate.scaleMultiplier(1.5, 1.0)).isEqualTo(1.5);
  }

  @Test
  void scaleMultiplier_stubbornGate_pullsTowardOne() {
    var scaled = AdaptabilityGate.scaleMultiplier(1.6, 0.2);

    assertThat(scaled).isCloseTo(1.0 + 0.6 * 0.2, within(1e-9));
  }

  @Test
  void scaleMultiplier_reactiveGate_pushesPastInput() {
    var scaled = AdaptabilityGate.scaleMultiplier(0.6, 1.4);

    assertThat(scaled).isCloseTo(1.0 + (-0.4) * 1.4, within(1e-9));
  }
}
