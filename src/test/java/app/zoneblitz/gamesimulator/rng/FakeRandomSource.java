package app.zoneblitz.gamesimulator.rng;

import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

/** Test double {@link RandomSource} that replays scripted draws in order. */
final class FakeRandomSource implements RandomSource {

  private final List<Long> longs;
  private final List<Double> doubles;
  private final AtomicInteger longCursor = new AtomicInteger();
  private final AtomicInteger doubleCursor = new AtomicInteger();

  FakeRandomSource(List<Long> longs, List<Double> doubles) {
    this.longs = List.copyOf(longs);
    this.doubles = List.copyOf(doubles);
  }

  @Override
  public long nextLong() {
    return longs.get(longCursor.getAndIncrement() % longs.size());
  }

  @Override
  public double nextDouble() {
    return doubles.get(doubleCursor.getAndIncrement() % doubles.size());
  }

  @Override
  public double nextGaussian() {
    return doubles.get(doubleCursor.getAndIncrement() % doubles.size());
  }

  @Override
  public RandomSource split(long key) {
    return this;
  }
}
