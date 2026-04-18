package app.zoneblitz.gamesimulator.formation;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.band.ClasspathBandRepository;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import java.util.HashMap;
import java.util.Map;
import java.util.Random;
import org.junit.jupiter.api.Test;

class BandBoxCountSamplerTests {

  private final BandBoxCountSampler sampler =
      BandBoxCountSampler.load(new ClasspathBandRepository());

  @Test
  void sample_onRuns_onlyReturnsSupportedBoxCounts() {
    var rng = new SeededRandom(42);
    var seen = new HashMap<Integer, Integer>();
    for (var i = 0; i < 20_000; i++) {
      var box = sampler.sample(OffensiveFormation.SINGLEBACK, PlayType.RUN, rng);
      seen.merge(box, 1, Integer::sum);
    }
    assertThat(seen.keySet()).allMatch(b -> b >= 4 && b <= 11);
  }

  @Test
  void sample_shotgunRuns_hasMean_matchingBand() {
    var rng = new SeededRandom(7);
    var total = 0L;
    var draws = 30_000;
    for (var i = 0; i < draws; i++) {
      total += sampler.sample(OffensiveFormation.SHOTGUN, PlayType.RUN, rng);
    }
    var mean = total / (double) draws;
    assertThat(mean).isCloseTo(6.32, org.assertj.core.data.Offset.offset(0.05));
  }

  @Test
  void sample_iFormPasses_hasHeavierBox_thanShotgunPasses() {
    var rng = new SeededRandom(101);
    var iFormTotal = 0L;
    var shotgunTotal = 0L;
    var draws = 10_000;
    for (var i = 0; i < draws; i++) {
      iFormTotal += sampler.sample(OffensiveFormation.I_FORM, PlayType.PASS, rng);
      shotgunTotal += sampler.sample(OffensiveFormation.SHOTGUN, PlayType.PASS, rng);
    }
    assertThat(iFormTotal / (double) draws).isGreaterThan(shotgunTotal / (double) draws + 1.0);
  }

  @Test
  void sample_emptyRuns_fallsBackToEmptyPasses() {
    // EMPTY has no run-side band (n<100 in BDB 2020) but does have a pass-side band.
    // The sampler should use the pass-side bucket rather than defaulting to SINGLEBACK.
    var rng = new SeededRandom(3);
    var emptyRunTotal = 0L;
    var singlebackRunTotal = 0L;
    var draws = 10_000;
    for (var i = 0; i < draws; i++) {
      emptyRunTotal += sampler.sample(OffensiveFormation.EMPTY, PlayType.RUN, rng);
      singlebackRunTotal += sampler.sample(OffensiveFormation.SINGLEBACK, PlayType.RUN, rng);
    }
    assertThat(emptyRunTotal / (double) draws).isLessThan(singlebackRunTotal / (double) draws);
  }

  @Test
  void weightedSample_deterministic_forGivenU() {
    var weights = new java.util.LinkedHashMap<Integer, Double>();
    weights.put(5, 0.2);
    weights.put(6, 0.5);
    weights.put(7, 0.3);

    assertThat(BandBoxCountSampler.weightedSample(weights, 0.10)).isEqualTo(5);
    assertThat(BandBoxCountSampler.weightedSample(weights, 0.50)).isEqualTo(6);
    assertThat(BandBoxCountSampler.weightedSample(weights, 0.90)).isEqualTo(7);
  }

  @Test
  void constructor_requiresFallbackFormations() {
    assertThatIllegalArgument(() -> new BandBoxCountSampler(Map.of(), Map.of()));
  }

  private static void assertThatIllegalArgument(Runnable r) {
    try {
      r.run();
      throw new AssertionError("expected IllegalArgumentException");
    } catch (IllegalArgumentException expected) {
      // ok
    }
  }

  /** Deterministic random backed by {@link java.util.Random} for statistical tests. */
  private static final class SeededRandom implements RandomSource {
    private final Random random;

    SeededRandom(long seed) {
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
      return this;
    }
  }
}
