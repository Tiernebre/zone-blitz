package app.zoneblitz.league;

/**
 * Interview noise-reduction function. Each completed interview multiplies the remaining noise above
 * the tier floor by {@code (1 - REDUCTION)} — geometric decay with diminishing returns. The
 * tier-dependent {@code FLOOR_STD} guarantees σ never reaches zero regardless of interview count,
 * preserving the hidden-info pillar from {@code busts-and-gems.md}.
 *
 * <p>σ(n) = FLOOR_STD + (INITIAL_STD − FLOOR_STD) · (1 − REDUCTION)^n
 */
final class InterviewNoiseModel {

  static final double HC_INITIAL_STD = 8.0;
  static final double HC_FLOOR_STD = 2.0;
  static final double REDUCTION_PER_INTERVIEW = 0.4;

  private InterviewNoiseModel() {}

  /**
   * Scouted-signal σ after {@code interviewCount} interviews, for the HC tier. Monotonically
   * non-increasing in {@code interviewCount}; strictly decreasing until it approaches {@link
   * #HC_FLOOR_STD}; never reaches zero.
   */
  static double headCoachSigma(int interviewCount) {
    if (interviewCount < 0) {
      throw new IllegalArgumentException("interviewCount must be >= 0, was: " + interviewCount);
    }
    var residual = HC_INITIAL_STD - HC_FLOOR_STD;
    return HC_FLOOR_STD + residual * Math.pow(1.0 - REDUCTION_PER_INTERVIEW, interviewCount);
  }
}
