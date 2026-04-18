package app.zoneblitz.gamesimulator.resolver;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.PlayCaller;
import app.zoneblitz.gamesimulator.band.ClasspathBandRepository;
import app.zoneblitz.gamesimulator.band.DefaultBandSampler;
import app.zoneblitz.gamesimulator.band.DistributionalBand;
import app.zoneblitz.gamesimulator.band.RateBand;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.TeamId;
import app.zoneblitz.gamesimulator.resolver.BaselinePassResolver.PassOutcomeKind;
import app.zoneblitz.gamesimulator.resolver.MatchupPassResolver.PassMatchupShift;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Team;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class MatchupPassResolverCalibrationTests {

  private static final int TRIALS = 10_000;
  private static final PlayCaller.PlayCall PASS_CALL = new PlayCaller.PlayCall("pass");

  private final ClasspathBandRepository repo = new ClasspathBandRepository();
  private final DefaultBandSampler sampler = new DefaultBandSampler();
  private final Team offense = offenseRoster();
  private final Team defense = defenseRoster();

  @Test
  void resolve_zeroShift_matchesBaselineResolverByteForByte() {
    var baseline = BaselinePassResolver.load(repo, sampler);
    var matchup = MatchupPassResolver.load(repo, sampler);

    var baselineRng = new SplittableRandomSource(7L);
    var matchupRng = new SplittableRandomSource(7L);
    var baselineOutcomes = new ArrayList<PlayOutcome>(1_000);
    var matchupOutcomes = new ArrayList<PlayOutcome>(1_000);
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
            boostedBand, (r, o, d) -> 1.0, completionYards, sackYards, scrambleYards, 11L);

    assertThat(shiftedCompletions)
        .as("β=+2 on COMPLETE with shift=+1 must raise completion count vs zero shift")
        .isGreaterThan(baselineCompletions + 500);
  }

  @Test
  void resolve_withoutQB_throwsIllegalState() {
    var resolver = MatchupPassResolver.load(repo, sampler);
    var noQbOffense =
        new Team(
            new TeamId(new UUID(9L, 9L)),
            "No QB",
            List.of(new Player(new PlayerId(new UUID(9L, 1L)), Position.WR, "WR")));

    assertThatThrownBy(
            () ->
                resolver.resolve(
                    PASS_CALL, state(), noQbOffense, defense, new SplittableRandomSource(1L)))
        .isInstanceOf(IllegalStateException.class);
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
            new PositionBasedRoleAssigner(),
            shift,
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

  private static PassOutcomeKind classify(PlayOutcome outcome) {
    return switch (outcome) {
      case PlayOutcome.PassComplete ignored -> PassOutcomeKind.COMPLETE;
      case PlayOutcome.PassIncomplete ignored -> PassOutcomeKind.INCOMPLETE;
      case PlayOutcome.Interception ignored -> PassOutcomeKind.INTERCEPTION;
      case PlayOutcome.Sack ignored -> PassOutcomeKind.SACK;
      case PlayOutcome.Scramble ignored -> PassOutcomeKind.SCRAMBLE;
      case PlayOutcome.Run ignored ->
          throw new AssertionError("pass resolver unexpectedly produced a Run outcome");
    };
  }

  private static GameState state() {
    return GameState.initial();
  }

  private static Team offenseRoster() {
    return new Team(
        new TeamId(new UUID(1L, 0L)),
        "Offense",
        List.of(
            new Player(new PlayerId(new UUID(1L, 1L)), Position.QB, "QB"),
            new Player(new PlayerId(new UUID(1L, 2L)), Position.WR, "WR1"),
            new Player(new PlayerId(new UUID(1L, 3L)), Position.WR, "WR2"),
            new Player(new PlayerId(new UUID(1L, 4L)), Position.TE, "TE1"),
            new Player(new PlayerId(new UUID(1L, 5L)), Position.RB, "RB1")));
  }

  private static Team defenseRoster() {
    return new Team(
        new TeamId(new UUID(2L, 0L)),
        "Defense",
        List.of(
            new Player(new PlayerId(new UUID(2L, 1L)), Position.CB, "CB1"),
            new Player(new PlayerId(new UUID(2L, 2L)), Position.CB, "CB2"),
            new Player(new PlayerId(new UUID(2L, 3L)), Position.S, "S1"),
            new Player(new PlayerId(new UUID(2L, 4L)), Position.LB, "LB1"),
            new Player(new PlayerId(new UUID(2L, 5L)), Position.DL, "DL1")));
  }
}
