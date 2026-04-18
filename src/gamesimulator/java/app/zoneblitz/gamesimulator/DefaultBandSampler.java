package app.zoneblitz.gamesimulator;

import java.util.HashMap;
import java.util.Map;

final class DefaultBandSampler implements BandSampler {

  private static final double EPSILON = 1e-9;

  @Override
  public <T> T sampleRate(RateBand<T> band, double matchupShift, RandomSource rng) {
    var shifted = new HashMap<T, Double>(band.baseProbabilities().size());
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

  private static double interpolate(DistributionalBand band, double u) {
    var ladder = new java.util.TreeMap<Double, Double>(band.percentileLadder());
    ladder.putIfAbsent(0.0, (double) band.min());
    ladder.putIfAbsent(1.0, (double) band.max());

    Map.Entry<Double, Double> lower = ladder.floorEntry(u);
    Map.Entry<Double, Double> upper = ladder.ceilingEntry(u);
    if (lower == null) {
      return upper.getValue();
    }
    if (upper == null) {
      return lower.getValue();
    }
    if (lower.getKey().equals(upper.getKey())) {
      return lower.getValue();
    }
    var fraction = (u - lower.getKey()) / (upper.getKey() - lower.getKey());
    return lower.getValue() + fraction * (upper.getValue() - lower.getValue());
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
