package app.zoneblitz.league;

import app.zoneblitz.gamesimulator.rng.RandomSource;
import java.util.Random;

/**
 * Deterministic {@link RandomSource} for league tests. Backed by {@link Random} with a fixed seed
 * so generator outputs are reproducible across runs. {@link #split(long)} returns a child with a
 * seed derived from the parent seed and the split key.
 */
public final class FakeRandomSource implements RandomSource {

  private final Random random;
  private final long seed;

  public FakeRandomSource(long seed) {
    this.seed = seed;
    this.random = new Random(seed);
  }

  @Override
  public long nextLong() {
    return random.nextLong();
  }

  @Override
  public double nextDouble() {
    return random.nextDouble();
  }

  @Override
  public double nextGaussian() {
    return random.nextGaussian();
  }

  @Override
  public RandomSource split(long key) {
    return new FakeRandomSource(seed ^ (key * 0x9E3779B97F4A7C15L));
  }
}
