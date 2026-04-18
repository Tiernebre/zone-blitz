package app.zoneblitz.gamesimulator.band;

/**
 * Loads calibrated bands from a backing store (typically classpath JSON under {@code bands/}).
 *
 * <p>F2 is plumbing-only: matchup coefficients ({@code β} for rate bands, {@code γ} for
 * distributional bands) default to {@code 0.0} and are not read from the JSON.
 */
public interface BandRepository {

  /**
   * Load a rate band from a JSON resource.
   *
   * <p>The band is located under {@code path} at {@code fieldPath} (a dotted path, e.g. {@code
   * "bands.outcome_mix"}). Each leaf under the addressed node is an object of shape {@code {"rate":
   * double, "n": int}}; keys are parsed into {@code T}. {@code outcomeType} must be {@code
   * String.class} or an {@code Enum} subtype.
   *
   * @throws IllegalArgumentException if the resource or field is missing or malformed
   */
  <T> RateBand<T> loadRate(String path, String fieldPath, Class<T> outcomeType);

  /**
   * Load a distributional band from a JSON resource.
   *
   * <p>The band is located under {@code path} at {@code fieldPath}. The addressed node must contain
   * integer fields {@code min}, {@code max}, and percentiles {@code p10, p25, p50, p75, p90}.
   *
   * @throws IllegalArgumentException if the resource or field is missing or malformed
   */
  DistributionalBand loadDistribution(String path, String fieldPath);
}
