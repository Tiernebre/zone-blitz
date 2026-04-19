package app.zoneblitz.gamesimulator.band;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.offset;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class DefaultBandSamplerSaturateTests {

  private static final double ASYMPTOTE = 0.6;

  @Test
  void saturate_atZero_returnsZero() {
    assertThat(DefaultBandSampler.saturate(0.0)).isEqualTo(0.0);
  }

  @Test
  void saturate_nearZero_hasSlopeOne() {
    assertThat(DefaultBandSampler.saturate(0.1)).isCloseTo(0.1, offset(1e-3));
    assertThat(DefaultBandSampler.saturate(-0.1)).isCloseTo(-0.1, offset(1e-3));
  }

  @ParameterizedTest
  @ValueSource(
      doubles = {-1e9, -100.0, -10.0, -1.0, -0.5, -0.1, 0.0, 0.1, 0.5, 1.0, 10.0, 100.0, 1e9})
  void saturate_anyFiniteShift_staysWithinAsymptote(double shift) {
    var result = DefaultBandSampler.saturate(shift);

    assertThat(Math.abs(result)).isLessThanOrEqualTo(ASYMPTOTE);
  }

  @ParameterizedTest
  @ValueSource(doubles = {0.1, 0.5, 1.0, 2.0, 5.0, 100.0})
  void saturate_isOddSymmetric(double shift) {
    assertThat(DefaultBandSampler.saturate(-shift)).isEqualTo(-DefaultBandSampler.saturate(shift));
  }

  @Test
  void saturate_largePositiveShift_approachesAsymptote() {
    assertThat(DefaultBandSampler.saturate(100.0)).isCloseTo(ASYMPTOTE, offset(1e-6));
  }

  @Test
  void saturate_largeNegativeShift_approachesNegativeAsymptote() {
    assertThat(DefaultBandSampler.saturate(-100.0)).isCloseTo(-ASYMPTOTE, offset(1e-6));
  }

  @Test
  void saturate_positiveInfinity_returnsAsymptote() {
    assertThat(DefaultBandSampler.saturate(Double.POSITIVE_INFINITY)).isEqualTo(ASYMPTOTE);
  }

  @Test
  void saturate_negativeInfinity_returnsNegativeAsymptote() {
    assertThat(DefaultBandSampler.saturate(Double.NEGATIVE_INFINITY)).isEqualTo(-ASYMPTOTE);
  }

  @Test
  void saturate_isMonotonicallyIncreasing() {
    var samples = new double[] {-10.0, -1.0, -0.5, -0.1, 0.0, 0.1, 0.5, 1.0, 10.0};
    for (var i = 1; i < samples.length; i++) {
      assertThat(DefaultBandSampler.saturate(samples[i]))
          .isGreaterThan(DefaultBandSampler.saturate(samples[i - 1]));
    }
  }
}
