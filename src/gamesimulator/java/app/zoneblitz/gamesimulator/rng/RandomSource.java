package app.zoneblitz.gamesimulator.rng;

/**
 * The one and only source of randomness inside the simulation engine. All stochastic code consumes
 * draws from this type so a game is reproducible from {@code (gameSeed, inputs)} alone.
 */
public interface RandomSource {

  /** Next pseudo-random 64-bit long. */
  long nextLong();

  /** Next pseudo-random double in {@code [0, 1)}. */
  double nextDouble();

  /**
   * Return a child source whose stream is independent of the parent's but deterministic given the
   * parent's seed and {@code key}. Used to split RNG per snap so a mid-game hiccup does not bleed
   * state.
   */
  RandomSource split(long key);
}
