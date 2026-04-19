package app.zoneblitz.league.hiring;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class InterviewNoiseModelTests {

  @Test
  void headCoachSigma_atZero_equalsInitial() {
    assertThat(InterviewNoiseModel.headCoachSigma(0)).isEqualTo(InterviewNoiseModel.HC_INITIAL_STD);
  }

  @Test
  void headCoachSigma_monotonicallyDecreasesAcrossInterviews() {
    var previous = InterviewNoiseModel.headCoachSigma(0);
    for (var i = 1; i <= 20; i++) {
      var current = InterviewNoiseModel.headCoachSigma(i);
      assertThat(current)
          .as("sigma must strictly decrease at interview %d", i)
          .isLessThan(previous);
      previous = current;
    }
  }

  @Test
  void headCoachSigma_neverReachesZero_evenAtLargeCounts() {
    for (var n : new int[] {10, 50, 100, 1_000, 10_000}) {
      assertThat(InterviewNoiseModel.headCoachSigma(n))
          .as("sigma at n=%d", n)
          .isGreaterThan(0.0)
          .isGreaterThanOrEqualTo(InterviewNoiseModel.HC_FLOOR_STD);
    }
  }

  @Test
  void headCoachSigma_asymptoticallyApproachesFloor() {
    assertThat(InterviewNoiseModel.headCoachSigma(100_000))
        .isCloseTo(InterviewNoiseModel.HC_FLOOR_STD, org.assertj.core.data.Offset.offset(1e-6));
  }

  @Test
  void headCoachSigma_negative_throws() {
    assertThatThrownBy(() -> InterviewNoiseModel.headCoachSigma(-1))
        .isInstanceOf(IllegalArgumentException.class);
  }
}
