package app.zoneblitz.gamesimulator;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashMap;
import java.util.Map;
import java.util.TreeMap;
import org.junit.jupiter.api.Test;

class BandSamplerCalibrationTests {

  private static final double WILSON_Z_99 = 2.5758;

  private final BandSampler sampler = new DefaultBandSampler();
  private final BandRepository repository = new ClasspathBandRepository();

  @Test
  void sampleRate_zeroShift_reproducesBaseProbabilities() {
    var band = repository.loadRate("passing-plays.json", "bands.outcome_mix", String.class);
    var rng = new SplittableRandomSource(42L);
    var trials = 10_000;
    var counts = new HashMap<String, Integer>();
    for (var outcome : band.baseProbabilities().keySet()) {
      counts.put(outcome, 0);
    }

    for (var i = 0; i < trials; i++) {
      var drawn = sampler.sampleRate(band, 0.0, rng);
      counts.merge(drawn, 1, Integer::sum);
    }

    for (var entry : band.baseProbabilities().entrySet()) {
      var observed = counts.get(entry.getKey()) / (double) trials;
      assertThat(wilsonContains(observed, trials, entry.getValue(), WILSON_Z_99))
          .as(
              "outcome %s: observed %.4f, expected %.4f",
              entry.getKey(), observed, entry.getValue())
          .isTrue();
    }
  }

  @Test
  void sampleRate_positiveShiftOnOutcome_increasesThatOutcomeFrequency() {
    var base =
        Map.of(
            "a", 0.25,
            "b", 0.25,
            "c", 0.25,
            "d", 0.25);
    var coefficients =
        Map.of(
            "a", 1.0,
            "b", 0.0,
            "c", 0.0,
            "d", 0.0);
    var band = new RateBand<>(base, coefficients);
    var rng = new SplittableRandomSource(7L);
    var trials = 10_000;
    var aCount = 0;
    for (var i = 0; i < trials; i++) {
      if ("a".equals(sampler.sampleRate(band, 1.0, rng))) {
        aCount++;
      }
    }
    var observed = aCount / (double) trials;
    assertThat(observed).isGreaterThan(base.get("a"));
  }

  @Test
  void sampleDistribution_zeroShift_reproducesPercentiles() {
    var band = completionYardsBand(0.0);
    var rng = new SplittableRandomSource(99L);
    var trials = 10_000;
    var samples = new int[trials];
    for (var i = 0; i < trials; i++) {
      samples[i] = sampler.sampleDistribution(band, 0.0, rng);
    }
    java.util.Arrays.sort(samples);

    assertPercentile(samples, 0.10, 2, 1);
    assertPercentile(samples, 0.25, 5, 1);
    assertPercentile(samples, 0.50, 8, 1);
    assertPercentile(samples, 0.75, 14, 1);
    assertPercentile(samples, 0.90, 22, 1);
  }

  @Test
  void sampleDistribution_respectsMinMax() {
    var band = completionYardsBand(0.0);
    var rng = new SplittableRandomSource(1234L);
    var min = band.min();
    var max = band.max();
    var trials = 1_000_000;
    var observedMin = Integer.MAX_VALUE;
    var observedMax = Integer.MIN_VALUE;
    for (var i = 0; i < trials; i++) {
      var v = sampler.sampleDistribution(band, 0.0, rng);
      if (v < observedMin) observedMin = v;
      if (v > observedMax) observedMax = v;
    }
    assertThat(observedMin).isGreaterThanOrEqualTo(min);
    assertThat(observedMax).isLessThanOrEqualTo(max);
  }

  @Test
  void sampleDistribution_positiveShift_raisesMedian() {
    var unshiftedBand = completionYardsBand(0.0);
    var shiftedBand = completionYardsBand(0.2);
    var trials = 10_000;

    var unshifted = new int[trials];
    var unshiftedRng = new SplittableRandomSource(2024L);
    for (var i = 0; i < trials; i++) {
      unshifted[i] = sampler.sampleDistribution(unshiftedBand, 0.0, unshiftedRng);
    }

    var shifted = new int[trials];
    var shiftedRng = new SplittableRandomSource(2024L);
    for (var i = 0; i < trials; i++) {
      shifted[i] = sampler.sampleDistribution(shiftedBand, 1.0, shiftedRng);
    }
    java.util.Arrays.sort(unshifted);
    java.util.Arrays.sort(shifted);
    var unshiftedMedian = unshifted[trials / 2];
    var shiftedMedian = shifted[trials / 2];
    assertThat(shiftedMedian).isGreaterThan(unshiftedMedian);
  }

  private static DistributionalBand completionYardsBand(double gamma) {
    var ladder = new TreeMap<Double, Double>();
    ladder.put(0.10, 2.0);
    ladder.put(0.25, 5.0);
    ladder.put(0.50, 8.0);
    ladder.put(0.75, 14.0);
    ladder.put(0.90, 22.0);
    return new DistributionalBand(-24, 98, ladder, gamma);
  }

  private static void assertPercentile(int[] sortedSamples, double p, int target, int tolerance) {
    var idx = (int) Math.round(p * (sortedSamples.length - 1));
    var observed = sortedSamples[idx];
    assertThat(observed)
        .as("p%.2f observed=%d target=%d tol=%d", p, observed, target, tolerance)
        .isBetween(target - tolerance, target + tolerance);
  }

  private static boolean wilsonContains(double observed, int trials, double expected, double z) {
    var denom = 1.0 + z * z / trials;
    var center = (observed + z * z / (2.0 * trials)) / denom;
    var halfWidth =
        z * Math.sqrt((observed * (1.0 - observed) + z * z / (4.0 * trials)) / trials) / denom;
    return expected >= center - halfWidth && expected <= center + halfWidth;
  }
}
