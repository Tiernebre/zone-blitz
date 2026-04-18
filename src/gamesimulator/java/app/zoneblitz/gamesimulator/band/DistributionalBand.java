package app.zoneblitz.gamesimulator.band;

import java.util.Collections;
import java.util.Objects;
import java.util.SortedMap;
import java.util.TreeMap;

/**
 * Distributional band: continuous value distribution sampled by percentile inversion.
 *
 * <p>{@code percentileLadder} keys are percentiles in {@code (0, 1)} (e.g. {@code 0.10, 0.25, 0.50,
 * 0.75, 0.90}); values are the value at that percentile. {@code min}/{@code max} pin the ceiling
 * and floor. {@code gamma} is the percentile-shift coefficient applied to matchup inputs; in F2 it
 * defaults to {@code 0.0}.
 */
public record DistributionalBand(
    int min, int max, SortedMap<Double, Double> percentileLadder, double gamma) {

  public DistributionalBand {
    Objects.requireNonNull(percentileLadder, "percentileLadder");
    if (min > max) {
      throw new IllegalArgumentException("min (" + min + ") must be <= max (" + max + ")");
    }
    percentileLadder = Collections.unmodifiableSortedMap(new TreeMap<>(percentileLadder));
  }
}
