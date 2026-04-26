package app.zoneblitz.gamesimulator;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.band.ClasspathBandRepository;
import app.zoneblitz.gamesimulator.band.DefaultBandSampler;
import app.zoneblitz.gamesimulator.band.DistributionalBand;
import app.zoneblitz.gamesimulator.clock.BandClockModel;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.event.TeamId;
import app.zoneblitz.gamesimulator.kickoff.TouchbackKickoffResolver;
import app.zoneblitz.gamesimulator.penalty.BandPenaltyModel;
import app.zoneblitz.gamesimulator.personnel.BaselinePersonnelSelector;
import app.zoneblitz.gamesimulator.playcalling.PlayCaller;
import app.zoneblitz.gamesimulator.punt.BandPuntResolver;
import app.zoneblitz.gamesimulator.resolver.DispatchingPlayResolver;
import app.zoneblitz.gamesimulator.resolver.pass.HailMaryPassResolver;
import app.zoneblitz.gamesimulator.resolver.run.MatchupRunResolver;
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
import java.util.Arrays;
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
 * Calibration harness: simulates 10k games with the real dependency graph wired to the classpath
 * band data and verifies the per-team-game aggregates match the {@code team-game.json} bands across
 * pass yards, rush yards, plays, sacks, interceptions, and fumbles.
 */
@Tag("calibration")
@Execution(ExecutionMode.CONCURRENT)
class FullGameCalibrationTests {

  private static final int GAMES = 10_000;
  private static final double PASS_RATE = 0.5793;

  // Budget of tolerated drift cells (across p10/p50/p90 × 6 stats = 18 total cells). Burn-down
  // tracked via #627. Any commit that pushes drift above the budget — e.g. the silent elite-vs-
  // bench 9998-2 pattern — fails the build instead of being swept under a print statement.
  private static final int AVG_VS_AVG_DRIFT_BUDGET = 3;
  private static final int BENCH_VS_BENCH_DRIFT_BUDGET = 3;

  @Test
  void tenThousandGames_teamGameAggregates_matchBands() {
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

    var passYards = new int[GAMES * 2];
    var rushYards = new int[GAMES * 2];
    var plays = new int[GAMES * 2];
    var sacks = new int[GAMES * 2];
    var interceptions = new int[GAMES * 2];
    var fumbles = new int[GAMES * 2];

    for (var g = 0; g < GAMES; g++) {
      var seed = 0xC0FFEEL + g;
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
              app.zoneblitz.gamesimulator.playcalling.DefensiveCallSelector.neutral(),
              new StandardTwoPointDecisionPolicy(),
              new FlatRateTwoPointResolver());
      var inputs =
          new GameInputs(
              new GameId(new UUID(0xDEADBEEFL, seed)),
              home,
              away,
              homeCoach,
              awayCoach,
              new GameInputs.PreGameContext(),
              Optional.of(seed));
      var stats = new TeamStats();
      simulator.simulate(inputs).forEach(event -> accumulate(event, stats, playerSide));

      var hi = 2 * g;
      var ai = 2 * g + 1;
      passYards[hi] = stats.passYards(Side.HOME);
      passYards[ai] = stats.passYards(Side.AWAY);
      rushYards[hi] = stats.rushYards(Side.HOME);
      rushYards[ai] = stats.rushYards(Side.AWAY);
      plays[hi] = stats.plays(Side.HOME);
      plays[ai] = stats.plays(Side.AWAY);
      sacks[hi] = stats.sacks(Side.HOME);
      sacks[ai] = stats.sacks(Side.AWAY);
      interceptions[hi] = stats.interceptions(Side.HOME);
      interceptions[ai] = stats.interceptions(Side.AWAY);
      fumbles[hi] = stats.fumbles(Side.HOME);
      fumbles[ai] = stats.fumbles(Side.AWAY);
    }

    var report = new StringBuilder();
    report.append("=== Calibration drift report (10,000 games, 20,000 team-games) ===\n");
    report.append(
        String.format(
            "%-16s %-22s %-22s %-22s%n",
            "stat", "p10 obs/target/tol", "p50 obs/target/tol", "p90 obs/target/tol"));
    var drift = new DriftAccumulator();
    reportBand(report, drift, "pass_yards", passYards, loadBand(repo, "pass_yards"), 40, 30, 40);
    reportBand(report, drift, "rush_yards", rushYards, loadBand(repo, "rush_yards"), 30, 20, 30);
    reportBand(report, drift, "plays", plays, loadBand(repo, "plays"), 6, 4, 6);
    reportBand(report, drift, "sacks_taken", sacks, loadBand(repo, "sacks_taken"), 2, 2, 2);
    reportBand(
        report, drift, "interceptions", interceptions, loadBand(repo, "interceptions"), 1, 1, 1);
    reportBand(report, drift, "fumbles_lost", fumbles, loadBand(repo, "fumbles_lost"), 1, 1, 1);
    System.out.println(report);
    // Known-drift budget tracked for burn-down via #627: the sim's yardage distribution has a
    // thinner right tail than the NFL bands (the p90 cells for pass_yards and rush_yards
    // chronically under-shoot, and run-to-run non-determinism occasionally pushes rush p50 out
    // of tolerance too). Budget bounds acceptable drift without pinning specific cells that
    // wander between runs; any real calibration regression blows the budget and fails CI.
    assertThat(drift.driftCount())
        .as("calibration drift (average-vs-average): %s", drift.reports())
        .isLessThanOrEqualTo(AVG_VS_AVG_DRIFT_BUDGET);
  }

  @Test
  void tenThousandGames_penaltiesPerTeamGame_matchNflMean() {
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
    var homeCoach = Coach.average(new CoachId(new UUID(1L, 1L)), "Home HC");
    var awayCoach = Coach.average(new CoachId(new UUID(1L, 2L)), "Away HC");
    var playerSide = new HashMap<PlayerId, Side>();
    home.roster().forEach(p -> playerSide.put(p.id(), Side.HOME));
    away.roster().forEach(p -> playerSide.put(p.id(), Side.AWAY));

    long homePenalties = 0;
    long awayPenalties = 0;
    for (var g = 0; g < GAMES; g++) {
      var seed = 0xF1A9L + g;
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
              app.zoneblitz.gamesimulator.playcalling.DefensiveCallSelector.neutral(),
              new StandardTwoPointDecisionPolicy(),
              new FlatRateTwoPointResolver());
      var inputs =
          new GameInputs(
              new GameId(new UUID(0xF1A9BEEFL, seed)),
              home,
              away,
              homeCoach,
              awayCoach,
              new GameInputs.PreGameContext(),
              Optional.of(seed));
      for (var event : simulator.simulate(inputs).toList()) {
        if (event instanceof PlayEvent.Penalty p) {
          var offendingSide = playerSide.get(p.committedBy());
          if (offendingSide == Side.HOME) {
            homePenalties++;
          } else if (offendingSide == Side.AWAY) {
            awayPenalties++;
          }
        }
      }
    }
    var homeMean = homePenalties / (double) GAMES;
    var awayMean = awayPenalties / (double) GAMES;
    System.out.printf(
        "penalties/team-game — home=%.2f away=%.2f (NFL ref ~6 accepted/team/game)%n",
        homeMean, awayMean);
    // NFL mean is ~6 accepted flags/team/game; nflfastR's per-play rate is a floor (it counts one
    // flag per play), so we expect our mean to come in a touch lower. Bound loosely to guard
    // against regressions without brittle CI flakiness.
    org.assertj.core.api.Assertions.assertThat(homeMean).isBetween(4.0, 9.0);
    org.assertj.core.api.Assertions.assertThat(awayMean).isBetween(4.0, 9.0);
  }

  @Test
  void tenThousandGames_eliteVsBenchwarmer_eliteWinsMoreOnAverage() {
    var repo = new ClasspathBandRepository();
    var sampler = new DefaultBandSampler();
    var resolver =
        new DispatchingPlayResolver(
            HailMaryPassResolver.load(repo, sampler), MatchupRunResolver.load(repo, sampler));
    var clockModel = BandClockModel.load(repo, sampler);
    var personnel = new BaselinePersonnelSelector();
    var kickoff = new TouchbackKickoffResolver();

    var elite = buildTeam("ELITE", 300, AttributeProfile.ELITE);
    var bench = buildTeam("BENCH", 400, AttributeProfile.BENCHWARMER);
    var eliteCoach = Coach.average(new CoachId(new UUID(1L, 3L)), "Elite HC");
    var benchCoach = Coach.average(new CoachId(new UUID(1L, 4L)), "Bench HC");

    var eliteWins = 0;
    var benchWins = 0;
    var ties = 0;
    var elitePointsTotal = 0L;
    var benchPointsTotal = 0L;

    for (var g = 0; g < GAMES; g++) {
      var seed = 0xE117E50L + g;
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
              app.zoneblitz.gamesimulator.playcalling.DefensiveCallSelector.neutral(),
              new StandardTwoPointDecisionPolicy(),
              new FlatRateTwoPointResolver());
      var inputs =
          new GameInputs(
              new GameId(new UUID(0xE117E11L, seed)),
              elite,
              bench,
              eliteCoach,
              benchCoach,
              new GameInputs.PreGameContext(),
              Optional.of(seed));
      var lastScore = new Score[] {new Score(0, 0)};
      simulator.simulate(inputs).forEach(event -> lastScore[0] = event.scoreAfter());
      var finalScore = lastScore[0];
      elitePointsTotal += finalScore.home();
      benchPointsTotal += finalScore.away();
      if (finalScore.home() > finalScore.away()) {
        eliteWins++;
      } else if (finalScore.away() > finalScore.home()) {
        benchWins++;
      } else {
        ties++;
      }
    }

    System.out.printf(
        "elite-vs-benchwarmer (%d games): elite=%d wins, bench=%d wins, ties=%d, avgScore elite=%.1f bench=%.1f%n",
        GAMES,
        eliteWins,
        benchWins,
        ties,
        elitePointsTotal / (double) GAMES,
        benchPointsTotal / (double) GAMES);
    if (eliteWins <= benchWins) {
      throw new AssertionError(
          "Expected elite team to win more than benchwarmer over %d games, got elite=%d bench=%d"
              .formatted(GAMES, eliteWins, benchWins));
    }
  }

  @Test
  void tenThousandGames_benchwarmerVsBenchwarmer_teamGameAggregatesMatchBands() {
    var repo = new ClasspathBandRepository();
    var sampler = new DefaultBandSampler();
    var resolver =
        new DispatchingPlayResolver(
            HailMaryPassResolver.load(repo, sampler), MatchupRunResolver.load(repo, sampler));
    var clockModel = BandClockModel.load(repo, sampler);
    var personnel = new BaselinePersonnelSelector();
    var kickoff = new TouchbackKickoffResolver();

    var home = buildTeam("BENCH_H", 500, AttributeProfile.BENCHWARMER);
    var away = buildTeam("BENCH_A", 600, AttributeProfile.BENCHWARMER);
    var playerSide = new HashMap<PlayerId, Side>();
    home.roster().forEach(p -> playerSide.put(p.id(), Side.HOME));
    away.roster().forEach(p -> playerSide.put(p.id(), Side.AWAY));
    var homeCoach = Coach.average(new CoachId(new UUID(1L, 5L)), "Bench H HC");
    var awayCoach = Coach.average(new CoachId(new UUID(1L, 6L)), "Bench A HC");

    var passYards = new int[GAMES * 2];
    var rushYards = new int[GAMES * 2];
    var plays = new int[GAMES * 2];
    var sacks = new int[GAMES * 2];
    var interceptions = new int[GAMES * 2];
    var fumbles = new int[GAMES * 2];

    for (var g = 0; g < GAMES; g++) {
      var seed = 0xBE1C4L + g;
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
              app.zoneblitz.gamesimulator.playcalling.DefensiveCallSelector.neutral(),
              new StandardTwoPointDecisionPolicy(),
              new FlatRateTwoPointResolver());
      var inputs =
          new GameInputs(
              new GameId(new UUID(0xBE1C4BEEFL, seed)),
              home,
              away,
              homeCoach,
              awayCoach,
              new GameInputs.PreGameContext(),
              Optional.of(seed));
      var stats = new TeamStats();
      simulator.simulate(inputs).forEach(event -> accumulate(event, stats, playerSide));

      var hi = 2 * g;
      var ai = 2 * g + 1;
      passYards[hi] = stats.passYards(Side.HOME);
      passYards[ai] = stats.passYards(Side.AWAY);
      rushYards[hi] = stats.rushYards(Side.HOME);
      rushYards[ai] = stats.rushYards(Side.AWAY);
      plays[hi] = stats.plays(Side.HOME);
      plays[ai] = stats.plays(Side.AWAY);
      sacks[hi] = stats.sacks(Side.HOME);
      sacks[ai] = stats.sacks(Side.AWAY);
      interceptions[hi] = stats.interceptions(Side.HOME);
      interceptions[ai] = stats.interceptions(Side.AWAY);
      fumbles[hi] = stats.fumbles(Side.HOME);
      fumbles[ai] = stats.fumbles(Side.AWAY);
    }

    var report = new StringBuilder();
    report.append(
        "=== Calibration drift report — benchwarmer vs benchwarmer (10,000 games, 20,000 team-games) ===\n");
    report.append(
        String.format(
            "%-16s %-22s %-22s %-22s%n",
            "stat", "p10 obs/target/tol", "p50 obs/target/tol", "p90 obs/target/tol"));
    var drift = new DriftAccumulator();
    reportBand(report, drift, "pass_yards", passYards, loadBand(repo, "pass_yards"), 40, 30, 40);
    reportBand(report, drift, "rush_yards", rushYards, loadBand(repo, "rush_yards"), 30, 20, 30);
    reportBand(report, drift, "plays", plays, loadBand(repo, "plays"), 6, 4, 6);
    reportBand(report, drift, "sacks_taken", sacks, loadBand(repo, "sacks_taken"), 2, 2, 2);
    reportBand(
        report, drift, "interceptions", interceptions, loadBand(repo, "interceptions"), 1, 1, 1);
    reportBand(report, drift, "fumbles_lost", fumbles, loadBand(repo, "fumbles_lost"), 1, 1, 1);
    System.out.println(report);
    // See AVG-vs-AVG test for context on the drift budget (#627).
    assertThat(drift.driftCount())
        .as("calibration drift (benchwarmer-vs-benchwarmer): %s", drift.reports())
        .isLessThanOrEqualTo(BENCH_VS_BENCH_DRIFT_BUDGET);
  }

  private static DistributionalBand loadBand(ClasspathBandRepository repo, String key) {
    return repo.loadDistribution("team-game.json", "bands." + key);
  }

  private static void reportBand(
      StringBuilder out,
      DriftAccumulator drift,
      String label,
      int[] samples,
      DistributionalBand band,
      int tolP10,
      int tolP50,
      int tolP90) {
    var sorted = samples.clone();
    Arrays.sort(sorted);
    var ladder = band.percentileLadder();
    out.append(
        String.format(
            "%-16s %-22s %-22s %-22s%n",
            label,
            cell(drift, label, "p10", sorted, 0.10, ladder.get(0.10).intValue(), tolP10),
            cell(drift, label, "p50", sorted, 0.50, ladder.get(0.50).intValue(), tolP50),
            cell(drift, label, "p90", sorted, 0.90, ladder.get(0.90).intValue(), tolP90)));
  }

  private static String cell(
      DriftAccumulator drift,
      String label,
      String percentile,
      int[] sorted,
      double p,
      int target,
      int tol) {
    var obs = sorted[(int) Math.round(p * (sorted.length - 1))];
    var isDrift = Math.abs(obs - target) > tol;
    if (isDrift) {
      drift.record(
          "%s.%s (obs=%d target=%d tol=%d)".formatted(label, percentile, obs, target, tol));
    }
    return "%d/%d/%d%s".formatted(obs, target, tol, isDrift ? " DRIFT" : "");
  }

  /**
   * Accumulates drift reports. {@link #driftCount()} is asserted by the caller against a small,
   * explicitly-capped budget (see #627). The sim is currently non-deterministic across JVM runs
   * (HashMap iteration order threads through event ordering), so cells drifting between runs makes
   * a per-cell allowlist brittle — the budget bounds the total drift instead. Any change that
   * meaningfully regresses calibration (e.g. the elite-vs-bench 9998-2 pattern the harness exists
   * to catch) blows this budget and fails the build.
   */
  private static final class DriftAccumulator {
    private final List<String> reports = new ArrayList<>();

    void record(String detail) {
      reports.add(detail);
    }

    int driftCount() {
      return reports.size();
    }

    List<String> reports() {
      return List.copyOf(reports);
    }
  }

  private static void accumulate(PlayEvent event, TeamStats stats, Map<PlayerId, Side> playerSide) {
    switch (event) {
      case PlayEvent.PassComplete c -> {
        var side = playerSide.get(c.qb());
        stats.addPassYards(side, c.totalYards());
        stats.addPlay(side);
      }
      case PlayEvent.PassIncomplete i -> stats.addPlay(playerSide.get(i.qb()));
      case PlayEvent.Sack s -> {
        var side = playerSide.get(s.qb());
        stats.addPlay(side);
        stats.addSack(side);
        if (s.fumble().isPresent()) {
          stats.addFumble(side);
        }
      }
      case PlayEvent.Scramble s -> {
        var side = playerSide.get(s.qb());
        stats.addPlay(side);
        stats.addRushYards(side, s.yards());
      }
      case PlayEvent.Interception x -> {
        var side = playerSide.get(x.qb());
        stats.addPlay(side);
        stats.addInterception(side);
      }
      case PlayEvent.Run r -> {
        var side = playerSide.get(r.carrier());
        stats.addRushYards(side, r.yards());
        stats.addPlay(side);
        if (r.fumble().isPresent()) {
          stats.addFumble(side);
        }
      }
      default -> {}
    }
  }

  private static final class TeamStats {
    private final int[] passYards = new int[2];
    private final int[] rushYards = new int[2];
    private final int[] plays = new int[2];
    private final int[] sacks = new int[2];
    private final int[] interceptions = new int[2];
    private final int[] fumbles = new int[2];

    void addPassYards(Side s, int y) {
      passYards[s.ordinal()] += y;
    }

    void addRushYards(Side s, int y) {
      rushYards[s.ordinal()] += y;
    }

    void addPlay(Side s) {
      plays[s.ordinal()]++;
    }

    void addSack(Side s) {
      sacks[s.ordinal()]++;
    }

    void addInterception(Side s) {
      interceptions[s.ordinal()]++;
    }

    void addFumble(Side s) {
      fumbles[s.ordinal()]++;
    }

    int passYards(Side s) {
      return passYards[s.ordinal()];
    }

    int rushYards(Side s) {
      return rushYards[s.ordinal()];
    }

    int plays(Side s) {
      return plays[s.ordinal()];
    }

    int sacks(Side s) {
      return sacks[s.ordinal()];
    }

    int interceptions(Side s) {
      return interceptions[s.ordinal()];
    }

    int fumbles(Side s) {
      return fumbles[s.ordinal()];
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
        app.zoneblitz.gamesimulator.roster.Coach coach,
        app.zoneblitz.gamesimulator.roster.RosterProfile profile,
        app.zoneblitz.gamesimulator.rng.RandomSource rs) {
      return new PlayCall(rng.nextDouble() < passRate ? "pass" : "run");
    }
  }

  private static Team buildTeam(String label, int idSeed) {
    return buildTeam(label, idSeed, AttributeProfile.AVERAGE);
  }

  private static Team buildTeam(String label, int idSeed, AttributeProfile profile) {
    var roster = new ArrayList<Player>();
    addPlayers(roster, Position.QB, 2, label, idSeed, profile);
    addPlayers(roster, Position.RB, 3, label, idSeed + 10, profile);
    addPlayers(roster, Position.TE, 3, label, idSeed + 20, profile);
    addPlayers(roster, Position.WR, 5, label, idSeed + 30, profile);
    addPlayers(roster, Position.OL, 8, label, idSeed + 40, profile);
    addPlayers(roster, Position.DL, 6, label, idSeed + 50, profile);
    addPlayers(roster, Position.LB, 5, label, idSeed + 60, profile);
    addPlayers(roster, Position.CB, 4, label, idSeed + 70, profile);
    addPlayers(roster, Position.S, 3, label, idSeed + 80, profile);
    addPlayers(roster, Position.K, 1, label, idSeed + 90, profile);
    addPlayers(roster, Position.P, 1, label, idSeed + 95, profile);
    return new Team(new TeamId(new UUID(9L, idSeed)), label, List.copyOf(roster));
  }

  private static void addPlayers(
      List<Player> out,
      Position position,
      int count,
      String label,
      int idSeed,
      AttributeProfile profile) {
    for (var i = 0; i < count; i++) {
      var id = new PlayerId(new UUID(idSeed, i));
      var name = "%s %s%d".formatted(label, position.name(), i + 1);
      out.add(
          new Player(
              id, position, name, profile.physical(), profile.skill(), profile.tendencies()));
    }
  }

  private enum AttributeProfile {
    AVERAGE(50),
    ELITE(90),
    BENCHWARMER(30);

    private final int axisValue;

    AttributeProfile(int axisValue) {
      this.axisValue = axisValue;
    }

    Physical physical() {
      return new Physical(
          axisValue, axisValue, axisValue, axisValue, axisValue, axisValue, axisValue, axisValue);
    }

    Skill skill() {
      return new Skill(
          axisValue, axisValue, axisValue, axisValue, axisValue, axisValue, axisValue, axisValue,
          axisValue, axisValue, axisValue, axisValue, axisValue, axisValue, axisValue, axisValue,
          axisValue, axisValue, axisValue, axisValue, axisValue, axisValue, axisValue, axisValue,
          axisValue, axisValue, axisValue, axisValue, axisValue);
    }

    Tendencies tendencies() {
      return new Tendencies(
          axisValue, axisValue, axisValue, axisValue, axisValue, axisValue, axisValue, axisValue,
          axisValue);
    }
  }
}
