package app.zoneblitz.gamesimulator.punt;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.zoneblitz.gamesimulator.band.BandSampler;
import app.zoneblitz.gamesimulator.band.ClasspathBandRepository;
import app.zoneblitz.gamesimulator.band.DefaultBandSampler;
import app.zoneblitz.gamesimulator.band.DistributionalBand;
import app.zoneblitz.gamesimulator.band.RateBand;
import app.zoneblitz.gamesimulator.event.DownAndDistance;
import app.zoneblitz.gamesimulator.event.FieldPosition;
import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.PuntResult;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.event.TeamId;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Team;
import java.util.EnumMap;
import java.util.List;
import java.util.TreeMap;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class BandPuntResolverTests {

  private static final PlayerId PUNTER_ID = new PlayerId(new UUID(1L, 1L));
  private static final PlayerId RETURNER_ID = new PlayerId(new UUID(2L, 1L));
  private static final Team KICKING =
      new Team(
          new TeamId(new UUID(1L, 0L)),
          "Kicking",
          List.of(new Player(PUNTER_ID, Position.P, "Punter")));
  private static final Team RECEIVING =
      new Team(
          new TeamId(new UUID(2L, 0L)),
          "Receiving",
          List.of(new Player(RETURNER_ID, Position.WR, "Returner")));
  private static final GameId GAME = new GameId(new UUID(9L, 9L));
  private static final DownAndDistance FOURTH_AND_TEN = new DownAndDistance(4, 10);
  private static final GameClock CLOCK = new GameClock(4, 120);
  private static final Score SCORE = new Score(7, 3);

  private static final DistributionalBand FLAT_45 = new DistributionalBand(45, 45, ladder(45), 0.0);
  private static final DistributionalBand FLAT_8 = new DistributionalBand(8, 8, ladder(8), 0.0);
  private static final DistributionalBand FLAT_60 = new DistributionalBand(60, 60, ladder(60), 0.0);

  @Test
  void resolve_touchbackOutcome_spotsDefenseAtReceiverTwenty() {
    var resolver =
        new BandPuntResolver(new FixedSampler(45, 8), FLAT_45, FLAT_8, 0.0, 1.0, 0.0, 0.0, 0.0);

    var resolved = resolve(resolver, 30);

    assertThat(resolved.event().result()).isEqualTo(PuntResult.TOUCHBACK);
    assertThat(resolved.receivingTakeoverYardLine()).isEqualTo(20);
    assertThat(resolved.event().returner()).isEmpty();
    assertThat(resolved.event().returnYards()).isZero();
    // Touchback forces reported gross to at least reach the end zone.
    assertThat(resolved.event().grossYards()).isGreaterThanOrEqualTo(70);
  }

  @Test
  void resolve_fairCatchOutcome_spotsDefenseAtLandingWithReturner() {
    var resolver =
        new BandPuntResolver(new FixedSampler(45, 8), FLAT_45, FLAT_8, 0.0, 0.0, 1.0, 0.0, 0.0);

    var resolved = resolve(resolver, 30);

    assertThat(resolved.event().result()).isEqualTo(PuntResult.FAIR_CATCH);
    // LOS 30 + gross 45 → landing 75 → receiver frame 25; no return.
    assertThat(resolved.receivingTakeoverYardLine()).isEqualTo(25);
    assertThat(resolved.event().returnYards()).isZero();
    assertThat(resolved.event().returner()).contains(RETURNER_ID);
  }

  @Test
  void resolve_returnedOutcome_addsReturnYardsToLandingSpot() {
    var resolver =
        new BandPuntResolver(new FixedSampler(45, 8), FLAT_45, FLAT_8, 0.0, 0.0, 0.0, 0.0, 0.0);

    var resolved = resolve(resolver, 30);

    assertThat(resolved.event().result()).isEqualTo(PuntResult.RETURNED);
    // landing recv = 25, return = 8 → takeover at recv 33.
    assertThat(resolved.receivingTakeoverYardLine()).isEqualTo(33);
    assertThat(resolved.event().returnYards()).isEqualTo(8);
    assertThat(resolved.event().returner()).contains(RETURNER_ID);
  }

  @Test
  void resolve_blockedOutcome_spotsDefenseBehindKickingLos() {
    var resolver =
        new BandPuntResolver(new FixedSampler(45, 8), FLAT_45, FLAT_8, 1.0, 0.0, 0.0, 0.0, 0.0);

    var resolved = resolve(resolver, 30);

    assertThat(resolved.event().result()).isEqualTo(PuntResult.BLOCKED);
    // Recovery at los-5 = 25 → receiver frame = 75.
    assertThat(resolved.receivingTakeoverYardLine()).isEqualTo(75);
    assertThat(resolved.event().grossYards()).isZero();
    assertThat(resolved.event().returner()).isEmpty();
  }

  @Test
  void resolve_downedOutcome_hasNoReturner() {
    var resolver =
        new BandPuntResolver(new FixedSampler(60, 8), FLAT_60, FLAT_8, 0.0, 0.0, 0.0, 1.0, 0.0);

    var resolved = resolve(resolver, 25);

    assertThat(resolved.event().result()).isEqualTo(PuntResult.DOWNED);
    assertThat(resolved.event().returner()).isEmpty();
    assertThat(resolved.event().returnYards()).isZero();
    // landing = 85, recv = 15.
    assertThat(resolved.receivingTakeoverYardLine()).isEqualTo(15);
  }

  @Test
  void constructor_rejectsRatesSummingAboveOne() {
    assertThatThrownBy(
            () ->
                new BandPuntResolver(
                    new FixedSampler(45, 8), FLAT_45, FLAT_8, 0.3, 0.3, 0.3, 0.3, 0.3))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("sum");
  }

  @Test
  void load_fromClasspathBands_buildsResolverThatProducesAllOutcomeBuckets() {
    var resolver = BandPuntResolver.load(new ClasspathBandRepository(), new DefaultBandSampler());
    var rng = new SplittableRandomSource(0xC0FFEEL);
    var counts = new EnumMap<PuntResult, Integer>(PuntResult.class);
    var totalGross = 0L;
    var trials = 10_000;
    for (var i = 0; i < trials; i++) {
      var resolved =
          resolver.resolve(
              KICKING,
              RECEIVING,
              Side.HOME,
              GAME,
              i,
              new FieldPosition(30),
              FOURTH_AND_TEN,
              CLOCK,
              SCORE,
              rng);
      counts.merge(resolved.event().result(), 1, Integer::sum);
      totalGross += resolved.event().grossYards();
    }
    // All non-muffed outcomes should appear at least a few times over 10k draws.
    assertThat(counts.keySet())
        .contains(
            PuntResult.TOUCHBACK,
            PuntResult.FAIR_CATCH,
            PuntResult.DOWNED,
            PuntResult.OUT_OF_BOUNDS,
            PuntResult.BLOCKED,
            PuntResult.RETURNED);
    // Band median gross is 47; the empirical mean should land in the same neighborhood.
    var meanGross = totalGross / (double) trials;
    assertThat(meanGross).isBetween(40.0, 55.0);
  }

  private static PuntResolver.Resolved resolve(BandPuntResolver resolver, int losYardLine) {
    return resolver.resolve(
        KICKING,
        RECEIVING,
        Side.HOME,
        GAME,
        0,
        new FieldPosition(losYardLine),
        FOURTH_AND_TEN,
        CLOCK,
        SCORE,
        new SplittableRandomSource(0L));
  }

  private static TreeMap<Double, Double> ladder(double v) {
    var map = new TreeMap<Double, Double>();
    map.put(0.10, v);
    map.put(0.25, v);
    map.put(0.50, v);
    map.put(0.75, v);
    map.put(0.90, v);
    return map;
  }

  /**
   * Deterministic sampler: returns {@code grossValue} for the first distributional draw per call to
   * {@code sampleDistribution} against the grossYards band and {@code returnValue} otherwise.
   * Rate-band sampling is unused by {@link BandPuntResolver}.
   */
  private static final class FixedSampler implements BandSampler {
    private final int grossValue;
    private final int returnValue;
    private boolean grossReturned;

    FixedSampler(int grossValue, int returnValue) {
      this.grossValue = grossValue;
      this.returnValue = returnValue;
    }

    @Override
    public <T> T sampleRate(RateBand<T> band, double matchupShift, RandomSource rng) {
      throw new UnsupportedOperationException("not used by BandPuntResolver");
    }

    @Override
    public int sampleDistribution(DistributionalBand band, double matchupShift, RandomSource rng) {
      if (!grossReturned) {
        grossReturned = true;
        return grossValue;
      }
      return returnValue;
    }
  }
}
