package app.zoneblitz.gamesimulator.resolver.pass;

import static app.zoneblitz.gamesimulator.CalibrationAssertions.assertPercentile;
import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.PlayCaller;
import app.zoneblitz.gamesimulator.band.ClasspathBandRepository;
import app.zoneblitz.gamesimulator.band.DefaultBandSampler;
import app.zoneblitz.gamesimulator.band.DistributionalBand;
import app.zoneblitz.gamesimulator.band.RateBand;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.formation.BandCoverageShellSampler;
import app.zoneblitz.gamesimulator.personnel.DefensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.TestPersonnel;
import app.zoneblitz.gamesimulator.resolver.PassOutcome;
import app.zoneblitz.gamesimulator.resolver.PositionBasedPassRoleAssigner;
import app.zoneblitz.gamesimulator.resolver.pass.MatchupPassResolver.PassMatchupShift;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class MatchupPassResolverCalibrationTests {

  private static final int TRIALS = 10_000;
  private static final PlayCaller.PlayCall PASS_CALL = new PlayCaller.PlayCall("pass");

  private final ClasspathBandRepository repo = new ClasspathBandRepository();
  private final DefaultBandSampler sampler = new DefaultBandSampler();
  private final OffensivePersonnel offense = TestPersonnel.baselineOffense();
  private final DefensivePersonnel defense = TestPersonnel.baselineDefense();

  @Test
  void resolve_zeroShift_outcomeRatesTrackBase() {
    var resolver = loadedResolver(PassMatchupShift.ZERO);
    var counts = sampleCounts(resolver, 99L);

    assertThat(counts.get(PassOutcomeKind.COMPLETE))
        .as("base complete rate ~0.5791 over 10k trials; ±3σ ≈ 5640..5940")
        .isBetween(5500, 6050);
    assertThat(counts.get(PassOutcomeKind.SACK))
        .as("base sack rate ~0.0629 over 10k trials")
        .isBetween(520, 740);
    assertThat(counts.get(PassOutcomeKind.INTERCEPTION))
        .as("base interception rate ~0.0203 over 10k trials")
        .isBetween(150, 270);
  }

  @Test
  void resolve_positiveShift_raisesCompletionsAndReducesSacks() {
    var zero = sampleCounts(loadedResolver(PassMatchupShift.ZERO), 11L);
    var boosted = sampleCounts(loadedResolver((ctx, rng) -> 2.0), 11L);

    assertThat(boosted.get(PassOutcomeKind.COMPLETE))
        .as("positive shift with positive COMPLETE β must raise completion count")
        .isGreaterThan(zero.get(PassOutcomeKind.COMPLETE));
    assertThat(boosted.get(PassOutcomeKind.SACK))
        .as("positive shift with negative SACK β must reduce sack count")
        .isLessThan(zero.get(PassOutcomeKind.SACK));
    assertThat(boosted.get(PassOutcomeKind.INTERCEPTION))
        .as("positive shift with negative INTERCEPTION β must reduce pick count")
        .isLessThan(zero.get(PassOutcomeKind.INTERCEPTION));
  }

  @Test
  void resolve_negativeShift_reducesCompletionsAndIncreasesSacks() {
    var zero = sampleCounts(loadedResolver(PassMatchupShift.ZERO), 22L);
    var suppressed = sampleCounts(loadedResolver((ctx, rng) -> -2.0), 22L);

    assertThat(suppressed.get(PassOutcomeKind.COMPLETE))
        .isLessThan(zero.get(PassOutcomeKind.COMPLETE));
    assertThat(suppressed.get(PassOutcomeKind.SACK)).isGreaterThan(zero.get(PassOutcomeKind.SACK));
  }

  @Test
  void resolve_conceptReachesShiftImplementation() {
    var seen =
        new java.util.concurrent.atomic.AtomicReference<
            app.zoneblitz.gamesimulator.event.PassConcept>();
    PassMatchupShift capturing =
        (ctx, rng) -> {
          seen.set(ctx.concept());
          return 0.0;
        };
    var resolver = buildResolver(loadedMix(), capturing);
    resolver.resolve(
        new PlayCaller.PlayCall("pass", app.zoneblitz.gamesimulator.event.PassConcept.SCREEN),
        state(),
        offense,
        defense,
        new SplittableRandomSource(4L));

    assertThat(seen.get()).isEqualTo(app.zoneblitz.gamesimulator.event.PassConcept.SCREEN);
  }

  @Test
  void resolve_equalAttributeRoster_wr1TargetShareReproducesPositionConcentration() {
    var resolver = MatchupPassResolver.load(repo, sampler);
    var wr1 = wr(1, "WR1");
    var wr2 = wr(2, "WR2");
    var wr3 = wr(3, "WR3");
    var calibrationOffense = TestPersonnel.offenseWith(wr1, wr2, wr3);
    var rng = new SplittableRandomSource(42L);
    var targetCounts = new HashMap<PlayerId, Integer>();
    var throwOutcomes = 0;

    for (var i = 0; i < TRIALS; i++) {
      var outcome = resolver.resolve(PASS_CALL, state(), calibrationOffense, defense, rng);
      var target = throwTarget(outcome);
      if (target.isPresent()) {
        targetCounts.merge(target.get(), 1, Integer::sum);
        throwOutcomes++;
      }
    }
    assertThat(throwOutcomes)
        .as("need a meaningful sample of throw-shaped outcomes for share math")
        .isGreaterThan(6_000);

    var wr1Count = targetCounts.getOrDefault(wr1.id(), 0);
    var wr2Count = targetCounts.getOrDefault(wr2.id(), 0);
    var wr3Count = targetCounts.getOrDefault(wr3.id(), 0);
    var wrTotal = wr1Count + wr2Count + wr3Count;

    assertThat(wrTotal)
        .as("WRs should receive a majority of throw targets")
        .isGreaterThan(throwOutcomes / 3);
    var wr1Share = (double) wr1Count / wrTotal;
    assertThat(wr1Share)
        .as("WR1 target share among WRs; band p10-p90 = [0.283, 0.467], symmetric-roster ~= 0.333")
        .isBetween(0.283, 0.467);
  }

  @Test
  void resolve_forcedComplete_yardagePercentilesMatchBand() {
    var resolver = buildResolver(forcedKind(PassOutcomeKind.COMPLETE), PassMatchupShift.ZERO);
    var yards = sampleYards(resolver, 101L, MatchupPassResolverCalibrationTests::completionYards);
    assertPercentile(yards, 0.10, 2, 1);
    assertPercentile(yards, 0.25, 5, 1);
    assertPercentile(yards, 0.50, 8, 1);
    assertPercentile(yards, 0.75, 14, 1);
    assertPercentile(yards, 0.90, 22, 1);
  }

  /**
   * Guardrail against tail-inflation bugs in {@link
   * app.zoneblitz.gamesimulator.band.DefaultBandSampler}: percentile assertions alone pass even
   * when the sampler linearly ramps into {@code max}, which drags the sampled mean far above the
   * reported band mean. Pinning the mean catches that class of bug.
   */
  @Test
  void resolve_forcedComplete_yardageMeanTracksReportedMean() {
    var resolver = buildResolver(forcedKind(PassOutcomeKind.COMPLETE), PassMatchupShift.ZERO);
    var yards = sampleYards(resolver, 103L, MatchupPassResolverCalibrationTests::completionYards);
    assertThat(meanOf(yards))
        .as("completion_yards band mean = 10.96; tail shape must not inflate it")
        .isBetween(10.0, 11.5);
  }

  @Test
  void resolve_forcedComplete_yardageRespectsBandMinMax() {
    var resolver = buildResolver(forcedKind(PassOutcomeKind.COMPLETE), PassMatchupShift.ZERO);
    var rng = new SplittableRandomSource(1337L);
    for (var i = 0; i < TRIALS; i++) {
      var y = completionYards(resolver.resolve(PASS_CALL, state(), offense, defense, rng));
      assertThat(y).isBetween(-24, 98);
    }
  }

  @Test
  void resolve_forcedSack_yardsLostPercentilesMatchBand() {
    var resolver = buildResolver(forcedKind(PassOutcomeKind.SACK), PassMatchupShift.ZERO);
    var lost = sampleYards(resolver, 104L, MatchupPassResolverCalibrationTests::sackYardsLost);
    assertPercentile(lost, 0.10, 1, 1);
    assertPercentile(lost, 0.25, 4, 1);
    assertPercentile(lost, 0.50, 7, 1);
    assertPercentile(lost, 0.75, 9, 1);
    assertPercentile(lost, 0.90, 11, 1);
  }

  @Test
  void resolve_forcedSack_yardsLostMeanTracksReportedMean() {
    var resolver = buildResolver(forcedKind(PassOutcomeKind.SACK), PassMatchupShift.ZERO);
    var lost = sampleYards(resolver, 105L, MatchupPassResolverCalibrationTests::sackYardsLost);
    assertThat(meanOf(lost))
        .as("sack_yards band mean = -6.70 ⇒ yardsLost mean ≈ 6.70")
        .isBetween(6.2, 7.2);
  }

  @Test
  void resolve_forcedScramble_yardagePercentilesMatchBand() {
    var resolver = buildResolver(forcedKind(PassOutcomeKind.SCRAMBLE), PassMatchupShift.ZERO);
    var yards = sampleYards(resolver, 106L, MatchupPassResolverCalibrationTests::scrambleYards);
    assertPercentile(yards, 0.10, 2, 1);
    assertPercentile(yards, 0.25, 3, 1);
    assertPercentile(yards, 0.50, 6, 1);
    assertPercentile(yards, 0.75, 10, 1);
    assertPercentile(yards, 0.90, 14, 1);
  }

  @Test
  void resolve_forcedScramble_yardageMeanTracksReportedMean() {
    var resolver = buildResolver(forcedKind(PassOutcomeKind.SCRAMBLE), PassMatchupShift.ZERO);
    var yards = sampleYards(resolver, 107L, MatchupPassResolverCalibrationTests::scrambleYards);
    assertThat(meanOf(yards))
        .as("scramble_yards band mean = 7.42; tail shape must not inflate it")
        .isBetween(6.5, 8.0);
  }

  @Test
  void resolve_forcedIncomplete_yardsAlwaysZero() {
    var resolver = buildResolver(forcedKind(PassOutcomeKind.INCOMPLETE), PassMatchupShift.ZERO);
    var rng = new SplittableRandomSource(108L);
    for (var i = 0; i < 1_000; i++) {
      var outcome = resolver.resolve(PASS_CALL, state(), offense, defense, rng);
      assertThat(outcome).isInstanceOf(PassOutcome.PassIncomplete.class);
      assertThat(((PassOutcome.PassIncomplete) outcome).airYards()).isZero();
    }
  }

  @Test
  void resolve_forcedInterception_returnYardsPercentilesMatchBand() {
    var resolver = buildResolver(forcedKind(PassOutcomeKind.INTERCEPTION), PassMatchupShift.ZERO);
    var returns =
        sampleYards(resolver, 201L, MatchupPassResolverCalibrationTests::interceptionReturn);
    assertPercentile(returns, 0.10, 0, 2);
    assertPercentile(returns, 0.25, 0, 2);
    assertPercentile(returns, 0.50, 4, 2);
    assertPercentile(returns, 0.75, 20, 3);
    assertPercentile(returns, 0.90, 34, 4);
  }

  @Test
  void resolve_forcedInterception_returnYardsMeanTracksReportedMean() {
    var resolver = buildResolver(forcedKind(PassOutcomeKind.INTERCEPTION), PassMatchupShift.ZERO);
    var returns =
        sampleYards(resolver, 202L, MatchupPassResolverCalibrationTests::interceptionReturn);
    assertThat(meanOf(returns))
        .as("interception_return_yards band mean = 12.23; tail shape must not inflate it")
        .isBetween(9.0, 15.0);
  }

  @Test
  void resolve_forcedInterception_returnYardsRespectsBandMinMax() {
    var resolver = buildResolver(forcedKind(PassOutcomeKind.INTERCEPTION), PassMatchupShift.ZERO);
    var rng = new SplittableRandomSource(203L);
    for (var i = 0; i < TRIALS; i++) {
      var r = interceptionReturn(resolver.resolve(PASS_CALL, state(), offense, defense, rng));
      assertThat(r).isBetween(-6, 103);
    }
  }

  private static int completionYards(PassOutcome outcome) {
    return ((PassOutcome.PassComplete) outcome).totalYards();
  }

  private static int sackYardsLost(PassOutcome outcome) {
    return ((PassOutcome.Sack) outcome).yardsLost();
  }

  private static int scrambleYards(PassOutcome outcome) {
    return ((PassOutcome.Scramble) outcome).yards();
  }

  private static int interceptionReturn(PassOutcome outcome) {
    return ((PassOutcome.Interception) outcome).returnYards();
  }

  private int[] sampleYards(
      MatchupPassResolver resolver,
      long seed,
      java.util.function.ToIntFunction<PassOutcome> extract) {
    var rng = new SplittableRandomSource(seed);
    var out = new int[TRIALS];
    for (var i = 0; i < TRIALS; i++) {
      out[i] = extract.applyAsInt(resolver.resolve(PASS_CALL, state(), offense, defense, rng));
    }
    java.util.Arrays.sort(out);
    return out;
  }

  private static double meanOf(int[] samples) {
    var sum = 0L;
    for (var s : samples) sum += s;
    return sum / (double) samples.length;
  }

  private static RateBand<PassOutcomeKind> forcedKind(PassOutcomeKind only) {
    var base = new EnumMap<PassOutcomeKind, Double>(PassOutcomeKind.class);
    for (var k : PassOutcomeKind.values()) {
      base.put(k, k == only ? 1.0 : 1e-9);
    }
    var betas = new EnumMap<PassOutcomeKind, Double>(PassOutcomeKind.class);
    for (var k : PassOutcomeKind.values()) {
      betas.put(k, 0.0);
    }
    return new RateBand<>(base, betas);
  }

  private RateBand<PassOutcomeKind> loadedMix() {
    var base =
        repo.loadRate("passing-plays.json", "bands.outcome_mix", PassOutcomeKind.class)
            .baseProbabilities();
    var betas =
        Map.of(
            PassOutcomeKind.COMPLETE, 0.4,
            PassOutcomeKind.INCOMPLETE, -0.1,
            PassOutcomeKind.INTERCEPTION, -0.4,
            PassOutcomeKind.SACK, -0.5,
            PassOutcomeKind.SCRAMBLE, 0.1);
    return new RateBand<>(base, betas);
  }

  private MatchupPassResolver loadedResolver(PassMatchupShift shift) {
    return buildResolver(loadedMix(), shift);
  }

  private MatchupPassResolver buildResolver(
      RateBand<PassOutcomeKind> outcomeMix, PassMatchupShift shift) {
    DistributionalBand completionYards =
        repo.loadDistribution("passing-plays.json", "bands.yardage.completion_yards");
    DistributionalBand sackYards =
        repo.loadDistribution("passing-plays.json", "bands.yardage.sack_yards");
    DistributionalBand scrambleYards =
        repo.loadDistribution("passing-plays.json", "bands.yardage.scramble_yards");
    DistributionalBand interceptionReturnYards =
        repo.loadDistribution("passing-plays.json", "bands.yardage.interception_return_yards");
    return new MatchupPassResolver(
        sampler,
        new PositionBasedPassRoleAssigner(),
        shift,
        BandCoverageShellSampler.load(repo),
        new ScoreBasedTargetSelector(),
        outcomeMix,
        completionYards,
        sackYards,
        scrambleYards,
        interceptionReturnYards);
  }

  private EnumMap<PassOutcomeKind, Integer> sampleCounts(MatchupPassResolver resolver, long seed) {
    var rng = new SplittableRandomSource(seed);
    var counts = new EnumMap<PassOutcomeKind, Integer>(PassOutcomeKind.class);
    for (var kind : PassOutcomeKind.values()) {
      counts.put(kind, 0);
    }
    for (var i = 0; i < TRIALS; i++) {
      counts.merge(
          classify(resolver.resolve(PASS_CALL, state(), offense, defense, rng)), 1, Integer::sum);
    }
    return counts;
  }

  private static Player wr(int seed, String name) {
    return new Player(new PlayerId(new UUID(3L, seed)), Position.WR, name);
  }

  private static PassOutcomeKind classify(PassOutcome outcome) {
    return switch (outcome) {
      case PassOutcome.PassComplete ignored -> PassOutcomeKind.COMPLETE;
      case PassOutcome.PassIncomplete ignored -> PassOutcomeKind.INCOMPLETE;
      case PassOutcome.Interception ignored -> PassOutcomeKind.INTERCEPTION;
      case PassOutcome.Sack ignored -> PassOutcomeKind.SACK;
      case PassOutcome.Scramble ignored -> PassOutcomeKind.SCRAMBLE;
    };
  }

  private static GameState state() {
    return GameState.initial();
  }

  private static Optional<PlayerId> throwTarget(PassOutcome outcome) {
    return switch (outcome) {
      case PassOutcome.PassComplete c -> Optional.of(c.target());
      case PassOutcome.PassIncomplete i -> Optional.of(i.target());
      case PassOutcome.Interception pick -> Optional.of(pick.intendedTarget());
      case PassOutcome.Sack ignored -> Optional.empty();
      case PassOutcome.Scramble ignored -> Optional.empty();
    };
  }
}
