package app.zoneblitz.gamesimulator.band;

import java.util.Map;
import java.util.Objects;

/**
 * Rate band: categorical outcome distribution sampled by weighted choice.
 *
 * <p>{@code baseProbabilities} are the baseline outcome rates summing to ~1.0. {@code
 * matchupCoefficients} ({@code β}) control how each outcome's log-odds shifts in response to a
 * matchup input. In F2 all coefficients are {@code 0.0} — sampling with any shift reproduces the
 * base distribution. Coefficients are tuned by the calibration harness.
 *
 * @param <T> outcome key type (typically {@code String} or an enum)
 */
public record RateBand<T>(Map<T, Double> baseProbabilities, Map<T, Double> matchupCoefficients) {

  public RateBand {
    Objects.requireNonNull(baseProbabilities, "baseProbabilities");
    Objects.requireNonNull(matchupCoefficients, "matchupCoefficients");
    baseProbabilities = Map.copyOf(baseProbabilities);
    matchupCoefficients = Map.copyOf(matchupCoefficients);
  }
}
