package app.zoneblitz.gamesimulator.resolver.run;

import static app.zoneblitz.gamesimulator.CalibrationAssertions.assertPercentile;
import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.band.ClasspathBandRepository;
import app.zoneblitz.gamesimulator.band.DefaultBandSampler;
import app.zoneblitz.gamesimulator.band.DistributionalBand;
import app.zoneblitz.gamesimulator.band.RateBand;
import app.zoneblitz.gamesimulator.event.RunConcept;
import app.zoneblitz.gamesimulator.personnel.DefensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.TestPersonnel;
import app.zoneblitz.gamesimulator.playcalling.PlayCaller;
import app.zoneblitz.gamesimulator.resolver.PositionBasedRunRoleAssigner;
import app.zoneblitz.gamesimulator.resolver.RunOutcome;
import app.zoneblitz.gamesimulator.resolver.run.MatchupRunResolver.RunMatchupShift;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

class MatchupRunResolverTests {

  private static final int TRIALS = 10_000;
  private static final PlayCaller.PlayCall RUN_CALL = new PlayCaller.PlayCall("run");

  private final ClasspathBandRepository repo = new ClasspathBandRepository();
  private final DefaultBandSampler sampler = new DefaultBandSampler();
  private final OffensivePersonnel offense = TestPersonnel.baselineOffense();
  private final DefensivePersonnel defense = TestPersonnel.baselineDefense();

  @Test
  void resolve_zeroShift_outcomeRatesTrackBase() {
    var resolver = loadedResolver(RunMatchupShift.ZERO);
    var counts = sampleCounts(resolver, 99L);

    assertThat(counts.stuffs)
        .as("base stuff rate ~0.1906 over 10k trials; ±3σ ≈ 1790..2030")
        .isBetween(1700, 2100);
    assertThat(counts.breakaways)
        .as("base breakaway rate ~0.0225 over 10k trials")
        .isBetween(160, 310);
    assertThat(counts.fumbles).as("base fumble rate ~0.0156 over 10k trials").isBetween(100, 220);
  }

  @Test
  void resolve_zeroShift_yardagePercentilesMatchOverallBand() {
    var resolver = loadedResolver(RunMatchupShift.ZERO);
    var rng = new SplittableRandomSource(42L);
    var yards = new ArrayList<Integer>(TRIALS);
    for (var i = 0; i < TRIALS; i++) {
      var run = (RunOutcome.Run) resolver.resolve(RUN_CALL, state(), offense, defense, rng);
      yards.add(run.yards());
    }
    var sorted = yards.stream().mapToInt(Integer::intValue).sorted().toArray();
    assertPercentile(sorted, 0.10, 0, 2);
    assertPercentile(sorted, 0.25, 1, 2);
    assertPercentile(sorted, 0.50, 3, 2);
    assertPercentile(sorted, 0.75, 6, 2);
    assertPercentile(sorted, 0.90, 10, 2);
  }

  @Test
  void resolve_zeroShift_yardageRespectsOverallMinMax() {
    var resolver = loadedResolver(RunMatchupShift.ZERO);
    var rng = new SplittableRandomSource(1337L);
    for (var i = 0; i < TRIALS; i++) {
      var run = (RunOutcome.Run) resolver.resolve(RUN_CALL, state(), offense, defense, rng);
      assertThat(run.yards()).isBetween(-28, 98);
    }
  }

  @Test
  void resolve_positiveShift_reducesStuffsAndIncreasesBreakaways() {
    var zero = sampleCounts(loadedResolver(RunMatchupShift.ZERO), 11L);
    var boosted = sampleCounts(loadedResolver((ctx, rng) -> 2.0), 11L);

    assertThat(boosted.stuffs)
        .as("positive shift with negative STUFF β must reduce stuff count")
        .isLessThan(zero.stuffs);
    assertThat(boosted.breakaways)
        .as("positive shift with positive BREAKAWAY β must increase breakaway count")
        .isGreaterThan(zero.breakaways);
  }

  @Test
  void resolve_negativeShift_increasesStuffsAndReducesBreakaways() {
    var zero = sampleCounts(loadedResolver(RunMatchupShift.ZERO), 22L);
    var suppressed = sampleCounts(loadedResolver((ctx, rng) -> -2.0), 22L);

    assertThat(suppressed.stuffs).isGreaterThan(zero.stuffs);
    assertThat(suppressed.breakaways).isLessThan(zero.breakaways);
  }

  @Test
  void resolve_stuffYards_neverPositive() {
    var resolver = buildResolver(forcedKind(RunOutcomeKind.STUFF), RunMatchupShift.ZERO);
    var rng = new SplittableRandomSource(7L);
    for (var i = 0; i < 1_000; i++) {
      var run = (RunOutcome.Run) resolver.resolve(RUN_CALL, state(), offense, defense, rng);
      assertThat(run.yards()).as("stuff bucket yards must be ≤ 0").isLessThanOrEqualTo(0);
      assertThat(run.fumble()).isEmpty();
    }
  }

  @Test
  void resolve_breakawayYards_alwaysTwentyPlus() {
    var resolver = buildResolver(forcedKind(RunOutcomeKind.BREAKAWAY), RunMatchupShift.ZERO);
    var rng = new SplittableRandomSource(8L);
    for (var i = 0; i < 1_000; i++) {
      var run = (RunOutcome.Run) resolver.resolve(RUN_CALL, state(), offense, defense, rng);
      assertThat(run.yards()).as("breakaway bucket yards must be ≥ 20").isGreaterThanOrEqualTo(20);
    }
  }

  @Test
  void resolve_fumbleKind_emitsFumbleOutcome() {
    var resolver = buildResolver(forcedKind(RunOutcomeKind.FUMBLE), RunMatchupShift.ZERO);
    var rng = new SplittableRandomSource(9L);
    for (var i = 0; i < 100; i++) {
      var run = (RunOutcome.Run) resolver.resolve(RUN_CALL, state(), offense, defense, rng);
      assertThat(run.fumble()).isPresent();
      var fumble = run.fumble().get();
      assertThat(fumble.recoveredBy())
          .as("every fumble event must carry a non-null recoverer")
          .isPresent();
      assertThat(fumble.fumbledBy()).isEqualTo(run.carrier());
      var recoverer = fumble.recoveredBy().get();
      if (fumble.defenseRecovered()) {
        assertThat(defense.players()).extracting(p -> p.id()).contains(recoverer);
      } else {
        assertThat(offense.players()).extracting(p -> p.id()).contains(recoverer);
        assertThat(recoverer).isNotEqualTo(fumble.fumbledBy());
      }
    }
  }

  @Test
  void resolve_fumbleKind_defenseRecoveryRateMatchesModelBand() {
    var resolver = buildResolver(forcedKind(RunOutcomeKind.FUMBLE), RunMatchupShift.ZERO);
    var rng = new SplittableRandomSource(909L);
    var trials = 5_000;
    var defenseRecoveries = 0;
    for (var i = 0; i < trials; i++) {
      var run = (RunOutcome.Run) resolver.resolve(RUN_CALL, state(), offense, defense, rng);
      if (run.fumble().orElseThrow().defenseRecovered()) {
        defenseRecoveries++;
      }
    }
    var rate = defenseRecoveries / (double) trials;
    assertThat(rate)
        .as("baseline recovery model flips ~50/50; ±3σ over 5k ≈ ±0.021")
        .isBetween(0.46, 0.54);
  }

  @Test
  void resolve_stampsCallRunConceptOnOutcome() {
    var resolver = loadedResolver(RunMatchupShift.ZERO);
    var sweepCall = new PlayCaller.PlayCall("run", RunConcept.SWEEP);
    var qbSneakCall = new PlayCaller.PlayCall("run", RunConcept.QB_SNEAK);
    var rng = new SplittableRandomSource(3L);

    var sweep = (RunOutcome.Run) resolver.resolve(sweepCall, state(), offense, defense, rng);
    var sneak = (RunOutcome.Run) resolver.resolve(qbSneakCall, state(), offense, defense, rng);

    assertThat(sweep.concept()).isEqualTo(RunConcept.SWEEP);
    assertThat(sneak.concept()).isEqualTo(RunConcept.QB_SNEAK);
  }

  @Test
  void resolve_conceptReachesShiftImplementation() {
    var seen = new java.util.concurrent.atomic.AtomicReference<RunConcept>();
    RunMatchupShift capturing =
        (ctx, rng) -> {
          seen.set(ctx.concept());
          return 0.0;
        };
    var resolver = loadedResolver(capturing);
    resolver.resolve(
        new PlayCaller.PlayCall("run", RunConcept.COUNTER),
        state(),
        offense,
        defense,
        new SplittableRandomSource(4L));

    assertThat(seen.get()).isEqualTo(RunConcept.COUNTER);
  }

  private MatchupRunResolver loadedResolver(RunMatchupShift shift) {
    var baseRates =
        repo.loadRate("rushing-plays.json", "bands.outcome_mix", RunOutcomeKind.class)
            .baseProbabilities();
    var betas =
        Map.of(
            RunOutcomeKind.STUFF, -0.4,
            RunOutcomeKind.NORMAL, 0.0,
            RunOutcomeKind.BREAKAWAY, 0.5,
            RunOutcomeKind.FUMBLE, -0.2);
    return buildResolver(new RateBand<>(baseRates, betas), shift);
  }

  private MatchupRunResolver buildResolver(RateBand<RunOutcomeKind> mix, RunMatchupShift shift) {
    var yardsByKind = new EnumMap<RunOutcomeKind, DistributionalBand>(RunOutcomeKind.class);
    yardsByKind.put(
        RunOutcomeKind.STUFF,
        repo.loadDistribution("rushing-plays.json", "bands.by_outcome.stuff"));
    yardsByKind.put(
        RunOutcomeKind.NORMAL,
        repo.loadDistribution("rushing-plays.json", "bands.by_outcome.normal"));
    yardsByKind.put(
        RunOutcomeKind.BREAKAWAY,
        repo.loadDistribution("rushing-plays.json", "bands.by_outcome.breakaway"));
    var fumbleYards = repo.loadDistribution("rushing-plays.json", "bands.overall");
    return new MatchupRunResolver(
        sampler, new PositionBasedRunRoleAssigner(), shift, mix, yardsByKind, fumbleYards);
  }

  private static RateBand<RunOutcomeKind> forcedKind(RunOutcomeKind only) {
    var base = new EnumMap<RunOutcomeKind, Double>(RunOutcomeKind.class);
    for (var k : RunOutcomeKind.values()) {
      base.put(k, k == only ? 1.0 : 1e-9);
    }
    var betas = new EnumMap<RunOutcomeKind, Double>(RunOutcomeKind.class);
    for (var k : RunOutcomeKind.values()) {
      betas.put(k, 0.0);
    }
    return new RateBand<>(base, betas);
  }

  private SampleCounts sampleCounts(MatchupRunResolver resolver, long seed) {
    var rng = new SplittableRandomSource(seed);
    var stuffs = 0;
    var breakaways = 0;
    var fumbles = 0;
    for (var i = 0; i < TRIALS; i++) {
      var run = (RunOutcome.Run) resolver.resolve(RUN_CALL, state(), offense, defense, rng);
      if (run.fumble().isPresent()) {
        fumbles++;
      } else if (run.yards() <= 0) {
        stuffs++;
      } else if (run.yards() >= 20) {
        breakaways++;
      }
    }
    return new SampleCounts(stuffs, breakaways, fumbles);
  }

  private record SampleCounts(int stuffs, int breakaways, int fumbles) {}

  private static GameState state() {
    return GameState.initial();
  }
}
