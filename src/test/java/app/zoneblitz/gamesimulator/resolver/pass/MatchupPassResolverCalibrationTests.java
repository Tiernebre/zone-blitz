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
import app.zoneblitz.gamesimulator.resolver.pass.BaselinePassResolver.PassOutcomeKind;
import app.zoneblitz.gamesimulator.resolver.pass.MatchupPassResolver.PassMatchupShift;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import java.util.ArrayList;
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
  void resolve_zeroShiftWithFirstRouteRunnerSelector_matchesBaselineResolverByteForByte() {
    var baseline = BaselinePassResolver.load(repo, sampler);
    var outcomeMix =
        repo.loadRate("passing-plays.json", "bands.outcome_mix", PassOutcomeKind.class);
    var completionYards =
        repo.loadDistribution("passing-plays.json", "bands.yardage.completion_yards");
    var sackYards = repo.loadDistribution("passing-plays.json", "bands.yardage.sack_yards");
    var scrambleYards = repo.loadDistribution("passing-plays.json", "bands.yardage.scramble_yards");
    var matchup =
        new MatchupPassResolver(
            sampler,
            new PositionBasedPassRoleAssigner(),
            PassMatchupShift.ZERO,
            BandCoverageShellSampler.load(repo),
            new FirstRouteRunnerTargetSelector(),
            outcomeMix,
            completionYards,
            sackYards,
            scrambleYards);

    var baselineRng = new SplittableRandomSource(7L);
    var matchupRng = new SplittableRandomSource(7L);
    var baselineOutcomes = new ArrayList<PassOutcome>(1_000);
    var matchupOutcomes = new ArrayList<PassOutcome>(1_000);
    for (var i = 0; i < 1_000; i++) {
      baselineOutcomes.add(baseline.resolve(PASS_CALL, state(), offense, defense, baselineRng));
      matchupOutcomes.add(matchup.resolve(PASS_CALL, state(), offense, defense, matchupRng));
    }

    assertThat(matchupOutcomes).isEqualTo(baselineOutcomes);
  }

  @Test
  void resolve_positiveShiftOnComplete_raisesCompletionRate() {
    var boostedBand =
        new RateBand<>(
            Map.of(
                PassOutcomeKind.COMPLETE, 0.5791,
                PassOutcomeKind.INCOMPLETE, 0.2908,
                PassOutcomeKind.INTERCEPTION, 0.0203,
                PassOutcomeKind.SACK, 0.0629,
                PassOutcomeKind.SCRAMBLE, 0.0469),
            Map.of(PassOutcomeKind.COMPLETE, 2.0));
    var completionYards =
        repo.loadDistribution("passing-plays.json", "bands.yardage.completion_yards");
    var sackYards = repo.loadDistribution("passing-plays.json", "bands.yardage.sack_yards");
    var scrambleYards = repo.loadDistribution("passing-plays.json", "bands.yardage.scramble_yards");

    var baselineCompletions =
        countCompletions(
            boostedBand, PassMatchupShift.ZERO, completionYards, sackYards, scrambleYards, 11L);
    var shiftedCompletions =
        countCompletions(
            boostedBand, (ctx, rng) -> 1.0, completionYards, sackYards, scrambleYards, 11L);

    assertThat(shiftedCompletions)
        .as("beta=+2 on COMPLETE with shift=+1 must raise completion count vs zero shift")
        .isGreaterThan(baselineCompletions + 500);
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

  private int countCompletions(
      RateBand<PassOutcomeKind> band,
      PassMatchupShift shift,
      DistributionalBand completionYards,
      DistributionalBand sackYards,
      DistributionalBand scrambleYards,
      long seed) {
    var resolver =
        new MatchupPassResolver(
            sampler,
            new PositionBasedPassRoleAssigner(),
            shift,
            BandCoverageShellSampler.load(repo),
            new ScoreBasedTargetSelector(),
            band,
            completionYards,
            sackYards,
            scrambleYards);
    var rng = new SplittableRandomSource(seed);
    var counts = new EnumMap<PassOutcomeKind, Integer>(PassOutcomeKind.class);
    for (var kind : PassOutcomeKind.values()) {
      counts.put(kind, 0);
    }
    for (var i = 0; i < TRIALS; i++) {
      counts.merge(
          classify(resolver.resolve(PASS_CALL, state(), offense, defense, rng)), 1, Integer::sum);
    }
    return counts.get(PassOutcomeKind.COMPLETE);
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
