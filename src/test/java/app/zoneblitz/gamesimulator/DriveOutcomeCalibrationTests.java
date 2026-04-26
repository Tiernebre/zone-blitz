package app.zoneblitz.gamesimulator;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.band.ClasspathBandRepository;
import app.zoneblitz.gamesimulator.band.DefaultBandSampler;
import app.zoneblitz.gamesimulator.clock.BandClockModel;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.Side;
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
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.util.UUID;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;

/**
 * Drive-outcome calibration harness for issue #615.
 *
 * <p>Simulates {@code GAMES} full games between average teams, reconstructs each drive's terminal
 * outcome from the event stream, and logs each bucket's delta from the matching NFL target derived
 * from nflfastR (2020–2023 regular-season, {@code fixed_drive_result}).
 *
 * <p>Reports drift only — does not fail the build on band misses. Bucket deltas reflect known sim
 * gaps (notably missing 4th-down go-for-it logic, which zeroes {@code TURNOVER_ON_DOWNS} and
 * inflates {@code PUNT}). The harness exists to make drift visible; tuning happens in follow-ups.
 *
 * <p>Real-NFL targets used below (per drive; {@code n = 23,880} drives):
 *
 * <ul>
 *   <li>Touchdown 22.05% (issue §Targets: ≈22%)
 *   <li>Field goal 14.70% (issue: ≈16%; nflfastR excludes missed FGs)
 *   <li>Punt 35.19% (issue: ≈38%)
 *   <li>Turnover (INT + fumble lost + blocked punt) 10.33% (issue: ≈12%)
 *   <li>Turnover on downs 5.41%
 *   <li>End of half / end of game 7.32%
 *   <li>Missed / blocked FG 2.53%
 *   <li>Opponent TD on drive (pick-6 etc.) 2.21%
 *   <li>Opponent safety 0.26%
 *   <li>3-and-out rate 19.95% (of drives; issue: ≈22%)
 * </ul>
 */
@Tag("calibration")
@Execution(ExecutionMode.CONCURRENT)
class DriveOutcomeCalibrationTests {

  private static final int GAMES = 10_000;
  private static final double PASS_RATE = 0.5793;

  @Test
  void tenThousandGames_driveOutcomeDistribution_reportsDriftVsNflTargets() {
    var repo = new ClasspathBandRepository();
    var sampler = new DefaultBandSampler();
    var resolver =
        new DispatchingPlayResolver(
            HailMaryPassResolver.load(repo, sampler), MatchupRunResolver.load(repo, sampler));
    var clockModel = BandClockModel.load(repo, sampler);
    var personnel = new BaselinePersonnelSelector();
    var kickoff = new TouchbackKickoffResolver();

    var home = buildTeam("HOME", 100);
    var away = buildTeam("AWAY", 200);
    var playerSide = new HashMap<PlayerId, Side>();
    home.roster().forEach(p -> playerSide.put(p.id(), Side.HOME));
    away.roster().forEach(p -> playerSide.put(p.id(), Side.AWAY));
    var homeCoach = Coach.average(new CoachId(new UUID(1L, 1L)), "Home HC");
    var awayCoach = Coach.average(new CoachId(new UUID(1L, 2L)), "Away HC");

    var counts = new EnumMap<DriveOutcome, Long>(DriveOutcome.class);
    for (var outcome : DriveOutcome.values()) {
      counts.put(outcome, 0L);
    }
    long totalDrives = 0;
    long threeAndOuts = 0;
    long threeAndOutPunts = 0;

    for (var g = 0; g < GAMES; g++) {
      var seed = 0xD71E00L + g;
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
              BandPuntResolver.load(repo, sampler),
              new BandPenaltyModel(),
              DefensiveCallSelector.neutral(),
              new StandardTwoPointDecisionPolicy(),
              new FlatRateTwoPointResolver());
      var inputs =
          new GameInputs(
              new GameId(new UUID(0xD71EBEEFL, seed)),
              home,
              away,
              homeCoach,
              awayCoach,
              new GameInputs.PreGameContext(),
              Optional.of(seed));
      var events = simulator.simulate(inputs).toList();
      var drives = DriveOutcomeClassifier.classify(events, playerSide);
      for (var drive : drives) {
        counts.merge(drive.outcome(), 1L, Long::sum);
        totalDrives++;
        if (drive.outcome() == DriveOutcome.PUNT && drive.offensivePlays() == 3) {
          threeAndOuts++;
          threeAndOutPunts++;
        }
      }
    }

    var shares = new EnumMap<DriveOutcome, Double>(DriveOutcome.class);
    for (var outcome : DriveOutcome.values()) {
      shares.put(outcome, counts.get(outcome) / (double) totalDrives);
    }
    var threeAndOutRate = threeAndOuts / (double) totalDrives;

    var report = new StringBuilder();
    report.append(
        "=== Drive outcome calibration (%,d games, %,d drives) ===%n"
            .formatted(GAMES, totalDrives));
    report.append(String.format("%-20s %8s %8s %8s%n", "bucket", "observed", "target", "delta_pp"));
    var targets = nflTargets();
    for (var outcome : DriveOutcome.values()) {
      var obs = shares.get(outcome);
      var target = targets.get(outcome);
      report.append(
          String.format(
              "%-20s %7.2f%% %7.2f%% %+8.2f%n",
              outcome.name(), obs * 100.0, target * 100.0, (obs - target) * 100.0));
    }
    report.append(
        String.format(
            "%-20s %7.2f%% %7.2f%% %+8.2f%n",
            "THREE_AND_OUT",
            threeAndOutRate * 100.0,
            THREE_AND_OUT_TARGET * 100.0,
            (threeAndOutRate - THREE_AND_OUT_TARGET) * 100.0));
    System.out.println(report);

    assertThat(totalDrives).as("at least 100k drives observed").isGreaterThan(100_000L);
    assertThat(threeAndOutPunts).isEqualTo(threeAndOuts);
  }

  private static final double THREE_AND_OUT_TARGET = 0.1995;

  private static Map<DriveOutcome, Double> nflTargets() {
    var targets = new EnumMap<DriveOutcome, Double>(DriveOutcome.class);
    targets.put(DriveOutcome.TOUCHDOWN, 0.2205);
    targets.put(DriveOutcome.FIELD_GOAL, 0.1470);
    targets.put(DriveOutcome.PUNT, 0.3519);
    targets.put(DriveOutcome.TURNOVER, 0.1033);
    targets.put(DriveOutcome.TURNOVER_ON_DOWNS, 0.0541);
    targets.put(DriveOutcome.END_OF_HALF, 0.0732);
    targets.put(DriveOutcome.MISSED_FIELD_GOAL, 0.0253);
    targets.put(DriveOutcome.OPP_TOUCHDOWN, 0.0221);
    targets.put(DriveOutcome.OPP_SAFETY, 0.0026);
    return Map.copyOf(targets);
  }

  private static final class BandPassRateCaller implements PlayCaller {
    private final double passRate;
    private final Random rng;

    BandPassRateCaller(double passRate, Random rng) {
      this.passRate = passRate;
      this.rng = rng;
    }

    @Override
    public PlayCall call(GameState state, Coach coach, RandomSource rs) {
      return new PlayCall(rng.nextDouble() < passRate ? "pass" : "run");
    }
  }

  private static Team buildTeam(String label, int idSeed) {
    var roster = new ArrayList<Player>();
    addPlayers(roster, Position.QB, 2, label, idSeed);
    addPlayers(roster, Position.RB, 3, label, idSeed + 10);
    addPlayers(roster, Position.TE, 3, label, idSeed + 20);
    addPlayers(roster, Position.WR, 5, label, idSeed + 30);
    addPlayers(roster, Position.OL, 8, label, idSeed + 40);
    addPlayers(roster, Position.DL, 6, label, idSeed + 50);
    addPlayers(roster, Position.LB, 5, label, idSeed + 60);
    addPlayers(roster, Position.CB, 4, label, idSeed + 70);
    addPlayers(roster, Position.S, 3, label, idSeed + 80);
    addPlayers(roster, Position.K, 1, label, idSeed + 90);
    addPlayers(roster, Position.P, 1, label, idSeed + 95);
    return new Team(new TeamId(new UUID(9L, idSeed)), label, List.copyOf(roster));
  }

  private static void addPlayers(
      List<Player> out, Position position, int count, String label, int idSeed) {
    var average = averagePhysical();
    var skill = averageSkill();
    var tendencies = averageTendencies();
    for (var i = 0; i < count; i++) {
      var id = new PlayerId(new UUID(idSeed, i));
      var name = "%s %s%d".formatted(label, position.name(), i + 1);
      out.add(new Player(id, position, name, average, skill, tendencies));
    }
  }

  private static Physical averagePhysical() {
    return new Physical(50, 50, 50, 50, 50, 50, 50, 50);
  }

  private static Skill averageSkill() {
    return new Skill(
        50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50,
        50, 50, 50, 50, 50, 50);
  }

  private static Tendencies averageTendencies() {
    return new Tendencies(50, 50, 50, 50, 50, 50, 50, 50, 50);
  }
}
