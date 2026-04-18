package app.zoneblitz.gamesimulator;

import java.util.SplittableRandom;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Production {@link RandomSource} backed by {@link SplittableRandom}. Deterministic: the same seed
 * produces the same stream across processes and JVMs.
 *
 * <p>{@link #split(long)} folds the key into a child seed using a SplitMix64-style mix so sibling
 * splits are independent even for small sequential keys.
 */
final class SplittableRandomSource implements RandomSource {

  private final SplittableRandom random;
  private final AtomicLong seed;

  SplittableRandomSource(long seed) {
    this.seed = new AtomicLong(seed);
    this.random = new SplittableRandom(seed);
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
  public RandomSource split(long key) {
    var childSeed = mix(seed.get() ^ key);
    return new SplittableRandomSource(childSeed);
  }

  private static long mix(long z) {
    z = (z ^ (z >>> 30)) * 0xbf58476d1ce4e5b7L;
    z = (z ^ (z >>> 27)) * 0x94d049bb133111ebL;
    return z ^ (z >>> 31);
  }
}
