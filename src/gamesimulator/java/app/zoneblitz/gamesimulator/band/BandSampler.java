package app.zoneblitz.gamesimulator.band;

import app.zoneblitz.gamesimulator.rng.RandomSource;
import java.util.Map;

/**
 * Single chokepoint for sampling values from calibrated bands. Every sim consumer that draws from a
 * band routes through this interface so the sampling math stays auditable and matchup coefficients
 * can be tuned in one place.
 */
public interface BandSampler {

  /**
   * Sample an outcome from a rate band.
   *
   * <p>Applies a log-odds shift per outcome ({@code logit(p') = logit(p_base) + β × matchupShift})
   * and renormalizes before drawing. When all {@code β} are zero (or {@code matchupShift} is zero)
   * the returned draws reproduce {@code band.baseProbabilities} within sampling error.
   *
   * @param band the rate band to sample from
   * @param matchupShift the scalar matchup input fed into the log-odds shift
   * @param rng randomness source; exactly one {@code nextDouble()} is consumed
   * @return the sampled outcome key
   */
  <T> T sampleRate(RateBand<T> band, double matchupShift, RandomSource rng);

  /**
   * Sample an outcome from a rate band with per-outcome logit offsets layered on top of the scalar
   * matchup shift. Each outcome's log-odds becomes {@code logit(p_base) + β × matchupShift +
   * logitOffsets.get(outcome)}; outcomes with no entry in {@code logitOffsets} behave as if offset
   * were {@code 0}.
   *
   * <p>Use this overload when a situational signal must move one outcome without dragging its
   * complement (e.g. raising sack probability on 3rd-and-long without also suppressing interception
   * probability the way a negative scalar shift would). When {@code logitOffsets} is empty the
   * result is identical to {@link #sampleRate(RateBand, double, RandomSource)}.
   *
   * @param band the rate band to sample from
   * @param matchupShift the scalar matchup input fed into the log-odds shift
   * @param logitOffsets per-outcome logit offsets; may be empty but must not be {@code null}
   * @param rng randomness source; exactly one {@code nextDouble()} is consumed
   * @return the sampled outcome key
   */
  default <T> T sampleRate(
      RateBand<T> band, double matchupShift, Map<T, Double> logitOffsets, RandomSource rng) {
    return sampleRate(band, matchupShift, rng);
  }

  /**
   * Sample a value from a distributional band.
   *
   * <p>Draws {@code u ~ U(0,1)}, shifts to {@code u' = clamp(u + γ × matchupShift, ε, 1 - ε)}, and
   * linearly interpolates on the percentile ladder. Values are clamped into {@code [min, max]}.
   * With {@code γ} or {@code matchupShift} zero, the returned draws reproduce the ladder's
   * percentiles.
   *
   * @param band the distributional band to sample from
   * @param matchupShift the scalar matchup input fed into the percentile shift
   * @param rng randomness source; exactly one {@code nextDouble()} is consumed
   * @return an integer value in {@code [band.min, band.max]}
   */
  int sampleDistribution(DistributionalBand band, double matchupShift, RandomSource rng);
}
