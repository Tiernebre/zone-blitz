package app.zoneblitz.gamesimulator.band;

import app.zoneblitz.gamesimulator.rng.RandomSource;
import java.util.LinkedHashMap;

public final class DefaultBandSampler implements BandSampler {

  private static final double EPSILON = 1e-9;

  @Override
  public <T> T sampleRate(RateBand<T> band, double matchupShift, RandomSource rng) {
    var shifted = new LinkedHashMap<T, Double>(band.baseProbabilities().size());
    var total = 0.0;
    for (var entry : band.baseProbabilities().entrySet()) {
      var outcome = entry.getKey();
      var pBase = clamp(entry.getValue(), EPSILON, 1.0 - EPSILON);
      var beta = band.matchupCoefficients().getOrDefault(outcome, 0.0);
      var shiftedLogit = logit(pBase) + beta * matchupShift;
      var pShifted = sigmoid(shiftedLogit);
      shifted.put(outcome, pShifted);
      total += pShifted;
    }
    var target = rng.nextDouble() * total;
    var cumulative = 0.0;
    T last = null;
    for (var entry : shifted.entrySet()) {
      cumulative += entry.getValue();
      last = entry.getKey();
      if (target <= cumulative) {
        return last;
      }
    }
    return last;
  }

  @Override
  public int sampleDistribution(DistributionalBand band, double matchupShift, RandomSource rng) {
    var u = rng.nextDouble();
    var uShifted = clamp(u + band.gamma() * matchupShift, EPSILON, 1.0 - EPSILON);
    var value = interpolate(band, uShifted);
    var clamped = Math.max(band.min(), Math.min(band.max(), (int) Math.round(value)));
    return clamped;
  }

  /**
   * Percentile-inversion interpolation with adaptive tail handling.
   *
   * <p>Between the first and last supplied percentile keys (typically p10..p90) we linearly
   * interpolate on the ladder. Outside that range we pick the tail shape based on how far the
   * boundary value ({@code min} or {@code max}) sits from the edge percentile relative to the width
   * of the adjacent inner bucket:
   *
   * <ul>
   *   <li>If the boundary is within {@code TAIL_LINEAR_RATIO ×} inner-bucket width of the edge
   *       (tight real tail — e.g. clock seconds bounded at 0), linearly interpolate to the
   *       boundary. Mean is preserved because the tail is genuinely short.
   *   <li>Otherwise (rare-outlier boundary — e.g. 98-yard completion), decay exponentially from the
   *       edge with scale equal to the inner-bucket width. Mean stays near the edge instead of
   *       being dragged toward the outlier, which matches real right-skewed yardage shapes.
   * </ul>
   *
   * {@code min}/{@code max} remain hard clamps applied in {@link #sampleDistribution} regardless of
   * which tail shape fires.
   */
  private static final double TAIL_LINEAR_RATIO = 2.0;

  private static double interpolate(DistributionalBand band, double u) {
    var ladder = new java.util.TreeMap<>(band.percentileLadder());
    if (ladder.isEmpty()) {
      return band.min() + u * (band.max() - band.min());
    }
    var firstKey = ladder.firstKey();
    var lastKey = ladder.lastKey();
    if (u <= firstKey) {
      return lowerTail(ladder, u, firstKey, band.min());
    }
    if (u >= lastKey) {
      return upperTail(ladder, u, lastKey, band.max());
    }
    var lower = ladder.floorEntry(u);
    var upper = ladder.ceilingEntry(u);
    if (lower.getKey().equals(upper.getKey())) {
      return lower.getValue();
    }
    var fraction = (u - lower.getKey()) / (upper.getKey() - lower.getKey());
    return lower.getValue() + fraction * (upper.getValue() - lower.getValue());
  }

  private static double lowerTail(
      java.util.NavigableMap<Double, Double> ladder, double u, double firstKey, double min) {
    var firstValue = ladder.get(firstKey);
    var innerWidth = innerBucketWidth(ladder, firstKey, /* fromTop= */ false);
    var boundaryGap = firstValue - min;
    if (boundaryGap <= TAIL_LINEAR_RATIO * innerWidth) {
      var fraction = u / firstKey;
      return min + fraction * (firstValue - min);
    }
    var scale = innerWidth > 0 ? innerWidth : 1.0;
    return firstValue + scale * Math.log(Math.max(u, 1e-12) / firstKey);
  }

  private static double upperTail(
      java.util.NavigableMap<Double, Double> ladder, double u, double lastKey, double max) {
    var lastValue = ladder.get(lastKey);
    var innerWidth = innerBucketWidth(ladder, lastKey, /* fromTop= */ true);
    var boundaryGap = max - lastValue;
    if (boundaryGap <= TAIL_LINEAR_RATIO * innerWidth) {
      var fraction = (u - lastKey) / (1.0 - lastKey);
      return lastValue + fraction * (max - lastValue);
    }
    var scale = innerWidth > 0 ? innerWidth : 1.0;
    return lastValue - scale * Math.log(Math.max(1.0 - u, 1e-12) / (1.0 - lastKey));
  }

  private static double innerBucketWidth(
      java.util.NavigableMap<Double, Double> ladder, double edgeKey, boolean fromTop) {
    var edgeValue = ladder.get(edgeKey);
    var neighborKey = fromTop ? ladder.lowerKey(edgeKey) : ladder.higherKey(edgeKey);
    if (neighborKey == null) {
      return 0.0;
    }
    return Math.abs(edgeValue - ladder.get(neighborKey));
  }

  private static double logit(double p) {
    return Math.log(p / (1.0 - p));
  }

  private static double sigmoid(double x) {
    return 1.0 / (1.0 + Math.exp(-x));
  }

  private static double clamp(double v, double lo, double hi) {
    return Math.max(lo, Math.min(hi, v));
  }
}
