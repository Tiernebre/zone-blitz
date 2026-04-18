package app.zoneblitz.gamesimulator.resolver.run;

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
import app.zoneblitz.gamesimulator.resolver.PositionBasedRunRoleAssigner;
import app.zoneblitz.gamesimulator.resolver.RunOutcome;
import app.zoneblitz.gamesimulator.resolver.run.MatchupRunResolver.RunMatchupShift;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Team;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class MatchupRunResolverTests {

  private static final int TRIALS = 10_000;
  private static final PlayCaller.PlayCall RUN_CALL = new PlayCaller.PlayCall("run");

  private final ClasspathBandRepository repo = new ClasspathBandRepository();
  private final DefaultBandSampler sampler = new DefaultBandSampler();
  private final Team offense = offenseRoster();
  private final Team defense = defenseRoster();

  @Test
  void resolve_zeroShiftOnAverageRoster_fumbleRateTracksBase() {
    var resolver = MatchupRunResolver.load(repo, sampler);
    var rng = new SplittableRandomSource(42L);
    var fumbles = 0;
    for (var i = 0; i < TRIALS; i++) {
      var outcome = (RunOutcome.Run) resolver.resolve(RUN_CALL, state(), offense, defense, rng);
      if (outcome.fumble().isPresent()) {
        fumbles++;
      }
    }
    assertThat(fumbles)
        .as("base fumble rate ~0.0156 over 10k trials; wide tolerance around ~156")
        .isBetween(100, 220);
  }

  @Test
  void resolve_positiveShiftOnNormal_reducesFumbleCount() {
    var boostedBand =
        new RateBand<>(
            Map.of(RunOutcomeKind.NORMAL, 0.9844, RunOutcomeKind.FUMBLE, 0.0156),
            Map.of(RunOutcomeKind.NORMAL, 2.0));
    var overallYards = repo.loadDistribution("rushing-plays.json", "bands.overall");

    var baselineFumbles = countFumbles(boostedBand, RunMatchupShift.ZERO, overallYards, 11L);
    var shiftedFumbles = countFumbles(boostedBand, (r, o, d) -> 1.0, overallYards, 11L);

    assertThat(shiftedFumbles)
        .as("β=+2 on NORMAL with shift=+1 must lower fumble count vs zero shift")
        .isLessThan(baselineFumbles);
  }

  @Test
  void resolve_yardageShift_pushesMeanUpward() {
    var outcomeMix = repo.loadRate("rushing-plays.json", "bands.outcome_mix", RunOutcomeKind.class);
    var yardsBand = repo.loadDistribution("rushing-plays.json", "bands.overall");
    var shiftedYardsBand =
        new DistributionalBand(yardsBand.min(), yardsBand.max(), yardsBand.percentileLadder(), 0.3);

    var meanZero =
        meanYards(
            new MatchupRunResolver(
                sampler,
                new PositionBasedRunRoleAssigner(),
                RunMatchupShift.ZERO,
                outcomeMix,
                yardsBand),
            21L);
    var meanShifted =
        meanYards(
            new MatchupRunResolver(
                sampler,
                new PositionBasedRunRoleAssigner(),
                (r, o, d) -> 1.0,
                outcomeMix,
                shiftedYardsBand),
            21L);

    assertThat(meanShifted).isGreaterThan(meanZero);
  }

  @Test
  void resolve_withoutCarrier_throwsIllegalState() {
    var resolver = MatchupRunResolver.load(repo, sampler);
    var noCarrier =
        new Team(
            new TeamId(new UUID(9L, 9L)),
            "No Carrier",
            List.of(new Player(new PlayerId(new UUID(9L, 1L)), Position.WR, "WR")));

    assertThatThrownBy(
            () ->
                resolver.resolve(
                    RUN_CALL, state(), noCarrier, defense, new SplittableRandomSource(1L)))
        .isInstanceOf(IllegalStateException.class);
  }

  private int countFumbles(
      RateBand<RunOutcomeKind> band, RunMatchupShift shift, DistributionalBand yards, long seed) {
    var resolver =
        new MatchupRunResolver(sampler, new PositionBasedRunRoleAssigner(), shift, band, yards);
    var rng = new SplittableRandomSource(seed);
    var fumbles = 0;
    for (var i = 0; i < TRIALS; i++) {
      var outcome = (RunOutcome.Run) resolver.resolve(RUN_CALL, state(), offense, defense, rng);
      if (outcome.fumble().isPresent()) {
        fumbles++;
      }
    }
    return fumbles;
  }

  private double meanYards(MatchupRunResolver resolver, long seed) {
    var rng = new SplittableRandomSource(seed);
    var sum = 0L;
    for (var i = 0; i < TRIALS; i++) {
      sum += ((RunOutcome.Run) resolver.resolve(RUN_CALL, state(), offense, defense, rng)).yards();
    }
    return (double) sum / TRIALS;
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
            new Player(new PlayerId(new UUID(1L, 2L)), Position.RB, "RB"),
            new Player(new PlayerId(new UUID(1L, 3L)), Position.OL, "LT"),
            new Player(new PlayerId(new UUID(1L, 4L)), Position.OL, "C"),
            new Player(new PlayerId(new UUID(1L, 5L)), Position.TE, "TE")));
  }

  private static Team defenseRoster() {
    return new Team(
        new TeamId(new UUID(2L, 0L)),
        "Defense",
        List.of(
            new Player(new PlayerId(new UUID(2L, 1L)), Position.DL, "DE"),
            new Player(new PlayerId(new UUID(2L, 2L)), Position.DL, "DT"),
            new Player(new PlayerId(new UUID(2L, 3L)), Position.LB, "MLB"),
            new Player(new PlayerId(new UUID(2L, 4L)), Position.S, "FS")));
  }
}
