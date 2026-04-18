package app.zoneblitz.gamesimulator;

import static org.assertj.core.api.Assertions.assertThat;

/** Shared assertions for band-driven calibration tests. */
public final class CalibrationAssertions {

  public static final double WILSON_Z_99 = 2.5758;

  private CalibrationAssertions() {}

  /**
   * Assert that the {@code p}-th percentile of {@code sortedSamples} (ascending) is within {@code
   * tolerance} of {@code target}. Indexing matches the standard "round to nearest rank" rule so the
   * same helper works for any sample size and percentile.
   */
  public static void assertPercentile(int[] sortedSamples, double p, int target, int tolerance) {
    var idx = (int) Math.round(p * (sortedSamples.length - 1));
    var observed = sortedSamples[idx];
    assertThat(observed)
        .as("p%.2f observed=%d target=%d tol=%d", p, observed, target, tolerance)
        .isBetween(target - tolerance, target + tolerance);
  }

  /**
   * Wilson score interval containment check — returns true when {@code expected} falls inside the
   * CI around {@code observed} given {@code trials} draws and a z-score. Use {@link #WILSON_Z_99}
   * for 99% CI.
   */
  public static boolean wilsonContains(double observed, int trials, double expected, double z) {
    var denom = 1.0 + z * z / trials;
    var centre = (observed + z * z / (2.0 * trials)) / denom;
    var radius =
        z * Math.sqrt((observed * (1.0 - observed) + z * z / (4.0 * trials)) / trials) / denom;
    return expected >= centre - radius && expected <= centre + radius;
  }
}
