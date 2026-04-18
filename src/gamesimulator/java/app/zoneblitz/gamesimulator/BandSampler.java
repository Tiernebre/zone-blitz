package app.zoneblitz.gamesimulator;

/**
 * Single chokepoint for sampling values from calibrated bands. Every sim consumer that draws from a
 * band routes through this interface so the sampling math stays auditable and matchup coefficients
 * can be tuned in one place.
 */
interface BandSampler {

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
