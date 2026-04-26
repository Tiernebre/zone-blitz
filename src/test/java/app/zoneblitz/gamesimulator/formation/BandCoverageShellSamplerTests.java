package app.zoneblitz.gamesimulator.formation;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.band.ClasspathBandRepository;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.TestPersonnel;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import java.util.EnumMap;
import java.util.Random;
import org.junit.jupiter.api.Test;

class BandCoverageShellSamplerTests {

  private static final OffensivePersonnel BASELINE = TestPersonnel.baselineOffense();
  private final BandCoverageShellSampler sampler =
      BandCoverageShellSampler.load(new ClasspathBandRepository());

  @Test
  void sample_singleback_producesMoreSingleHigh_thanShotgun() {
    // BDB 2023: SINGLEBACK is 45% Cover-3 + 20% Cover-1 = 65% single-high;
    // SHOTGUN is 28% + 25% = 53%. Expect the gap to show in the sample.
    var rng = new SeededRandom(123);
    var sbSingleHigh = 0;
    var sgSingleHigh = 0;
    var draws = 20_000;
    for (var i = 0; i < draws; i++) {
      if (isSingleHigh(sampler.sample(OffensiveFormation.SINGLEBACK, BASELINE, rng)))
        sbSingleHigh++;
      if (isSingleHigh(sampler.sample(OffensiveFormation.SHOTGUN, BASELINE, rng))) sgSingleHigh++;
    }
    assertThat(sbSingleHigh / (double) draws).isGreaterThan(sgSingleHigh / (double) draws + 0.05);
  }

  @Test
  void sample_jumbo_fallsBackToOverall() {
    // JUMBO is below the BDB sample threshold so it falls back to `overall`. Draws should still
    // yield a non-empty shell distribution without throwing.
    var rng = new SeededRandom(7);
    var seen = new EnumMap<CoverageShell, Integer>(CoverageShell.class);
    for (var i = 0; i < 10_000; i++) {
      var shell = sampler.sample(OffensiveFormation.JUMBO, BASELINE, rng);
      seen.merge(shell, 1, Integer::sum);
    }
    assertThat(seen).containsKey(CoverageShell.COVER_3).containsKey(CoverageShell.COVER_1);
  }

  @Test
  void sample_zoneRate_matchesBand_atFormationLevel() {
    // BDB 2023 shotgun: 64% zone, 31% man. Tolerate Monte Carlo noise.
    var rng = new SeededRandom(17);
    var zone = 0;
    var draws = 20_000;
    for (var i = 0; i < draws; i++) {
      if (sampler.sample(OffensiveFormation.SHOTGUN, BASELINE, rng).type() == CoverageType.ZONE)
        zone++;
    }
    assertThat(zone / (double) draws).isCloseTo(0.637, org.assertj.core.data.Offset.offset(0.02));
  }

  @Test
  void weightedSample_deterministic_forGivenU() {
    var weights = new java.util.LinkedHashMap<CoverageShell, Double>();
    weights.put(CoverageShell.COVER_3, 0.3);
    weights.put(CoverageShell.COVER_1, 0.2);
    weights.put(CoverageShell.QUARTERS, 0.5);

    assertThat(BandCoverageShellSampler.weightedSample(weights, 0.20))
        .isEqualTo(CoverageShell.COVER_3);
    assertThat(BandCoverageShellSampler.weightedSample(weights, 0.40))
        .isEqualTo(CoverageShell.COVER_1);
    assertThat(BandCoverageShellSampler.weightedSample(weights, 0.90))
        .isEqualTo(CoverageShell.QUARTERS);
  }

  private static boolean isSingleHigh(CoverageShell shell) {
    return shell == CoverageShell.COVER_1 || shell == CoverageShell.COVER_3;
  }

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
