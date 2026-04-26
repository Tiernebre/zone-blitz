package app.zoneblitz.gamesimulator;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.band.ClasspathBandRepository;
import app.zoneblitz.gamesimulator.band.DefaultBandSampler;
import app.zoneblitz.gamesimulator.clock.BandClockModel;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.TeamId;
import app.zoneblitz.gamesimulator.kickoff.TouchbackKickoffResolver;
import app.zoneblitz.gamesimulator.penalty.BandPenaltyModel;
import app.zoneblitz.gamesimulator.personnel.BaselinePersonnelSelector;
import app.zoneblitz.gamesimulator.playcalling.DefensiveCallSelector;
import app.zoneblitz.gamesimulator.playcalling.PlayCaller;
import app.zoneblitz.gamesimulator.punt.BandPuntResolver;
import app.zoneblitz.gamesimulator.resolver.DispatchingPlayResolver;
import app.zoneblitz.gamesimulator.resolver.pass.HailMaryPassResolver;
import app.zoneblitz.gamesimulator.resolver.run.MatchupRunResolver;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Coach;
import app.zoneblitz.gamesimulator.roster.CoachId;
import app.zoneblitz.gamesimulator.roster.Physical;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Skill;
import app.zoneblitz.gamesimulator.roster.Team;
import app.zoneblitz.gamesimulator.roster.Tendencies;
import app.zoneblitz.gamesimulator.scoring.DistanceCurveFieldGoalResolver;
import app.zoneblitz.gamesimulator.scoring.FlatRateExtraPointResolver;
import app.zoneblitz.gamesimulator.scoring.FlatRateTwoPointResolver;
import app.zoneblitz.gamesimulator.scoring.StandardTwoPointDecisionPolicy;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Random;
import java.util.UUID;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;

/**
 * Axis-by-axis talent sweep: runs short-game samples across a range of offense/defense talent gaps
 * and asserts the resulting score curve is monotonic and bounded.
 *
 * <p>Regression-defense for the class of bug fixed in commit 3594f92 ("saturate matchup shift to
 * bound talent blowouts"), where per-snap matchup shifts compounded across a game produced 9998-2
 * win/loss ratios at the elite-vs-bench extreme. Testing only AVERAGE/AVERAGE, BENCH/BENCH, and
 * ELITE/BENCH leaves the curve between endpoints uncovered; this test samples seven (offense,
 * defense) axis pairs so a sharp cliff or inversion in the matchup math trips a failure instantly.
 *
 * <p>Uses fewer games per pair (1k) than {@link FullGameCalibrationTests} to keep CI cost in check
 * while still averaging out per-game variance enough to surface curve distortions.
 */
@Tag("calibration")
@Execution(ExecutionMode.CONCURRENT)
class TalentAxisSweepCalibrationTests {

  private static final int GAMES_PER_PAIR = 1_000;
  private static final double PASS_RATE = 0.5793;
  private static final long SWEEP_SEED_BASE = 0x5A1E5L;

  /** Offense/defense axis pairs sweeping from matched talent up to an extreme gap. */
  private static final List<AxisPair> PAIRS =
      List.of(
          new AxisPair(50, 50),
          new AxisPair(55, 45),
          new AxisPair(60, 40),
          new AxisPair(65, 35),
          new AxisPair(70, 30),
          new AxisPair(80, 20),
          new AxisPair(90, 10));

  @Test
  void sweep_acrossTalentGaps_winRateAndMarginStayMonotonicAndBounded() {
    var results = new ArrayList<SweepResult>();
    for (var pair : PAIRS) {
      results.add(simulatePair(pair));
    }

    var report = new StringBuilder();
    report.append("=== Talent axis sweep (%d games/pair) ===%n".formatted(GAMES_PER_PAIR));
    report.append(
        "%-10s %-8s %-8s %-8s %-12s %-12s %-10s%n"
            .formatted("pair", "offWins", "defWins", "ties", "avgOff", "avgDef", "avgMargin"));
    for (var r : results) {
      report.append(
          "%-10s %-8d %-8d %-8d %-12.2f %-12.2f %-10.2f%n"
              .formatted(
                  "%dv%d".formatted(r.pair.offense(), r.pair.defense()),
                  r.offenseWins,
                  r.defenseWins,
                  r.ties,
                  r.avgOffensePoints(),
                  r.avgDefensePoints(),
                  r.avgMargin()));
    }
    System.out.print(report);

    // Matched talent (50v50) should be near a coin flip.
    var matched = results.get(0);
    assertThat(matched.offenseWinRate())
        .as("50v50 win rate should be near .5")
        .isBetween(0.40, 0.60);
    assertThat(matched.avgMargin()).as("50v50 avg margin should be near 0").isBetween(-5.0, 5.0);

    // Monotonicity: as the gap widens, offense win rate must not drop and avg margin must not
    // shrink. Epsilons absorb sampling noise — at 1,000 games/pair the between-pair std of win
    // rate is ~2.2pp, so a 10pp floor is ~4σ and keeps real inversions catchable while tolerating
    // stochastic dips.
    for (var i = 1; i < results.size(); i++) {
      var prev = results.get(i - 1);
      var curr = results.get(i);
      assertThat(curr.offenseWinRate())
          .as(
              "win rate must not decrease as talent gap widens: %s -> %s",
              prev.label(), curr.label())
          .isGreaterThanOrEqualTo(prev.offenseWinRate() - 0.10);
      assertThat(curr.avgMargin())
          .as(
              "avg margin must not shrink as talent gap widens: %s -> %s",
              prev.label(), curr.label())
          .isGreaterThanOrEqualTo(prev.avgMargin() - 4.0);
    }

    // No cliff: adjacent pairs should not jump by more than ~30 percentage points in win rate or
    // ~14 points in avg margin. A smooth logistic curve over a 10-point axis step stays well inside
    // these bounds; the saturate() regression this test defends would blow through both.
    for (var i = 1; i < results.size(); i++) {
      var prev = results.get(i - 1);
      var curr = results.get(i);
      var winRateStep = curr.offenseWinRate() - prev.offenseWinRate();
      var marginStep = curr.avgMargin() - prev.avgMargin();
      assertThat(winRateStep)
          .as("win-rate step between %s and %s should be smooth", prev.label(), curr.label())
          .isLessThanOrEqualTo(0.30);
      assertThat(marginStep)
          .as("avg-margin step between %s and %s should be smooth", prev.label(), curr.label())
          .isLessThanOrEqualTo(14.0);
    }

    // Extreme gap (90v10) must not degenerate into a shutout blowout. The pre-saturate() bug put
    // avg margin at +37 and offense-win rate at 9998/10000 for elite-vs-bench; bound the extreme
    // so that regression is caught instantly.
    var extreme = results.get(results.size() - 1);
    assertThat(extreme.offenseWinRate())
        .as("extreme-gap offense win rate should not reach shutout territory")
        .isLessThanOrEqualTo(0.995);
    assertThat(extreme.avgMargin())
        .as("extreme-gap avg margin should stay inside a realistic NFL blowout envelope")
        .isLessThanOrEqualTo(35.0);
    assertThat(extreme.avgDefensePoints())
        .as("extreme-gap losing side should still score some points on average")
        .isGreaterThanOrEqualTo(3.0);
  }

  private static SweepResult simulatePair(AxisPair pair) {
    var repo = new ClasspathBandRepository();
    var sampler = new DefaultBandSampler();
    var resolver =
        new DispatchingPlayResolver(
            HailMaryPassResolver.load(repo, sampler), MatchupRunResolver.load(repo, sampler));
    var clockModel = BandClockModel.load(repo, sampler);
    var personnel = new BaselinePersonnelSelector();
    var kickoff = new TouchbackKickoffResolver();
    var puntResolver = BandPuntResolver.load(repo, sampler);

    var offense =
        buildTeam("OFF_%d".formatted(pair.offense()), 700 + pair.offense(), pair.offense());
    var defense =
        buildTeam("DEF_%d".formatted(pair.defense()), 800 + pair.defense(), pair.defense());
    var offenseCoach = Coach.average(new CoachId(new UUID(2L, pair.offense())), "Off HC");
    var defenseCoach = Coach.average(new CoachId(new UUID(2L, pair.defense())), "Def HC");

    var offenseWins = 0;
    var defenseWins = 0;
    var ties = 0;
    var offensePoints = 0L;
    var defensePoints = 0L;

    for (var g = 0; g < GAMES_PER_PAIR; g++) {
      var seed = SWEEP_SEED_BASE + 1_000_000L * pair.offense() + g;
      var caller = new BandPassRateCaller(PASS_RATE, new Random(seed ^ 0xC411L));
      var simulator =
          new GameSimulator(
              caller,
              personnel,
              resolver,
              clockModel,
              kickoff,
              new FlatRateExtraPointResolver(),
              new DistanceCurveFieldGoalResolver(),
              puntResolver,
              new BandPenaltyModel(),
              DefensiveCallSelector.neutral(),
              new StandardTwoPointDecisionPolicy(),
              new FlatRateTwoPointResolver());
      var offenseIsHome = (g & 1) == 0;
      var home = offenseIsHome ? offense : defense;
      var away = offenseIsHome ? defense : offense;
      var homeCoach = offenseIsHome ? offenseCoach : defenseCoach;
      var awayCoach = offenseIsHome ? defenseCoach : offenseCoach;
      var inputs =
          new GameInputs(
              new GameId(new UUID(0x5A1E5BEEFL, seed)),
              home,
              away,
              homeCoach,
              awayCoach,
              new GameInputs.PreGameContext(),
              Optional.of(seed));
      var lastScore = new Score[] {new Score(0, 0)};
      simulator.simulate(inputs).forEach(event -> lastScore[0] = event.scoreAfter());
      var finalScore = lastScore[0];
      var offenseScore = offenseIsHome ? finalScore.home() : finalScore.away();
      var defenseScore = offenseIsHome ? finalScore.away() : finalScore.home();
      offensePoints += offenseScore;
      defensePoints += defenseScore;
      if (offenseScore > defenseScore) {
        offenseWins++;
      } else if (defenseScore > offenseScore) {
        defenseWins++;
      } else {
        ties++;
      }
    }

    return new SweepResult(pair, offenseWins, defenseWins, ties, offensePoints, defensePoints);
  }

  private static Team buildTeam(String label, int idSeed, int axisValue) {
    var roster = new ArrayList<Player>();
    addPlayers(roster, Position.QB, 2, label, idSeed, axisValue);
    addPlayers(roster, Position.RB, 3, label, idSeed + 10, axisValue);
    addPlayers(roster, Position.TE, 3, label, idSeed + 20, axisValue);
    addPlayers(roster, Position.WR, 5, label, idSeed + 30, axisValue);
    addPlayers(roster, Position.OL, 8, label, idSeed + 40, axisValue);
    addPlayers(roster, Position.DL, 6, label, idSeed + 50, axisValue);
    addPlayers(roster, Position.LB, 5, label, idSeed + 60, axisValue);
    addPlayers(roster, Position.CB, 4, label, idSeed + 70, axisValue);
    addPlayers(roster, Position.S, 3, label, idSeed + 80, axisValue);
    addPlayers(roster, Position.K, 1, label, idSeed + 90, axisValue);
    addPlayers(roster, Position.P, 1, label, idSeed + 95, axisValue);
    return new Team(new TeamId(new UUID(11L, idSeed)), label, List.copyOf(roster));
  }

  private static void addPlayers(
      List<Player> out, Position position, int count, String label, int idSeed, int axisValue) {
    for (var i = 0; i < count; i++) {
      var id = new app.zoneblitz.gamesimulator.event.PlayerId(new UUID(idSeed, i));
      var name = "%s %s%d".formatted(label, position.name(), i + 1);
      var physical =
          new Physical(
              axisValue, axisValue, axisValue, axisValue, axisValue, axisValue, axisValue,
              axisValue);
      var skill =
          new Skill(
              axisValue, axisValue, axisValue, axisValue, axisValue, axisValue, axisValue,
              axisValue, axisValue, axisValue, axisValue, axisValue, axisValue, axisValue,
              axisValue, axisValue, axisValue, axisValue, axisValue, axisValue, axisValue,
              axisValue, axisValue, axisValue, axisValue, axisValue, axisValue, axisValue,
              axisValue);
      var tendencies =
          new Tendencies(
              axisValue, axisValue, axisValue, axisValue, axisValue, axisValue, axisValue,
              axisValue, axisValue);
      out.add(new Player(id, position, name, physical, skill, tendencies));
    }
  }

  private record AxisPair(int offense, int defense) {}

  private record SweepResult(
      AxisPair pair,
      int offenseWins,
      int defenseWins,
      int ties,
      long offensePointsTotal,
      long defensePointsTotal) {

    double offenseWinRate() {
      return offenseWins / (double) (offenseWins + defenseWins + ties);
    }

    double avgOffensePoints() {
      return offensePointsTotal / (double) games();
    }

    double avgDefensePoints() {
      return defensePointsTotal / (double) games();
    }

    double avgMargin() {
      return avgOffensePoints() - avgDefensePoints();
    }

    int games() {
      return offenseWins + defenseWins + ties;
    }

    String label() {
      return "%dv%d".formatted(pair.offense(), pair.defense());
    }
  }

  private static final class BandPassRateCaller implements PlayCaller {
    private final double passRate;
    private final Random rng;

    BandPassRateCaller(double passRate, Random rng) {
      this.passRate = passRate;
      this.rng = rng;
    }

    @Override
    public PlayCall call(
        GameState state,
        Coach coach,
        app.zoneblitz.gamesimulator.roster.RosterProfile profile,
        RandomSource rs) {
      return new PlayCall(rng.nextDouble() < passRate ? "pass" : "run");
    }
  }
}
