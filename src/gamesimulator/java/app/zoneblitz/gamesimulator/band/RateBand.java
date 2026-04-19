package app.zoneblitz.gamesimulator.band;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

/**
 * Rate band: categorical outcome distribution sampled by weighted choice.
 *
 * <p>{@code baseProbabilities} are the baseline outcome rates summing to ~1.0. {@code
 * matchupCoefficients} ({@code β}) control how each outcome's log-odds shifts in response to a
 * matchup input. All coefficients default to {@code 0.0} until the calibration harness tunes them —
 * with {@code β = 0} sampling at any shift reproduces the base distribution.
 *
 * @param <T> outcome key type (typically {@code String} or an enum)
 */
public record RateBand<T>(Map<T, Double> baseProbabilities, Map<T, Double> matchupCoefficients) {

  public RateBand {
    Objects.requireNonNull(baseProbabilities, "baseProbabilities");
    Objects.requireNonNull(matchupCoefficients, "matchupCoefficients");
    // Map.copyOf would JVM-salt iteration order, which is sampled over in cumulative weighted
    // draws — breaking determinism across JVM runs.
    baseProbabilities = Collections.unmodifiableMap(new LinkedHashMap<>(baseProbabilities));
    matchupCoefficients = Collections.unmodifiableMap(new LinkedHashMap<>(matchupCoefficients));
  }
}
