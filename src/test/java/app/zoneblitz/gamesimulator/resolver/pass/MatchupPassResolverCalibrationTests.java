package app.zoneblitz.gamesimulator.resolver.pass;

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
    return new MatchupPassResolver(
        sampler,
        new PositionBasedPassRoleAssigner(),
        shift,
        BandCoverageShellSampler.load(repo),
        new ScoreBasedTargetSelector(),
        outcomeMix,
        completionYards,
        sackYards,
        scrambleYards);
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
