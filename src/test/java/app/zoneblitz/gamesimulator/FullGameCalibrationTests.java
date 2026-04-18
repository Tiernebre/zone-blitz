package app.zoneblitz.gamesimulator;

import app.zoneblitz.gamesimulator.band.ClasspathBandRepository;
import app.zoneblitz.gamesimulator.band.DefaultBandSampler;
import app.zoneblitz.gamesimulator.band.DistributionalBand;
import app.zoneblitz.gamesimulator.clock.BandClockModel;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.event.TeamId;
import app.zoneblitz.gamesimulator.kickoff.TouchbackKickoffResolver;
import app.zoneblitz.gamesimulator.personnel.BaselinePersonnelSelector;
import app.zoneblitz.gamesimulator.punt.BandPuntResolver;
import app.zoneblitz.gamesimulator.resolver.DispatchingPlayResolver;
import app.zoneblitz.gamesimulator.resolver.pass.MatchupPassResolver;
import app.zoneblitz.gamesimulator.resolver.run.MatchupRunResolver;
import app.zoneblitz.gamesimulator.roster.Coach;
import app.zoneblitz.gamesimulator.roster.CoachId;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Team;
import app.zoneblitz.gamesimulator.scoring.DistanceCurveFieldGoalResolver;
import app.zoneblitz.gamesimulator.scoring.FlatRateExtraPointResolver;
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

/**
 * Calibration harness: simulates 10k games with the real dependency graph wired to the classpath
 * band data and verifies the per-team-game aggregates match the {@code team-game.json} bands across
 * pass yards, rush yards, plays, sacks, interceptions, and fumbles.
 */
@Tag("calibration")
class FullGameCalibrationTests {

  private static final int GAMES = 10_000;
  private static final double PASS_RATE = 0.5793;

  @Test
  void tenThousandGames_teamGameAggregates_matchBands() {
    var repo = new ClasspathBandRepository();
    var sampler = new DefaultBandSampler();
    var resolver =
        new DispatchingPlayResolver(
            MatchupPassResolver.load(repo, sampler), MatchupRunResolver.load(repo, sampler));
    var clockModel = BandClockModel.load(repo, sampler);
    var personnel = new BaselinePersonnelSelector();
    var kickoff = new TouchbackKickoffResolver();

    var home = buildTeam("HOME", 100);
    var away = buildTeam("AWAY", 200);
    var playerSide = new HashMap<PlayerId, Side>();
    home.roster().forEach(p -> playerSide.put(p.id(), Side.HOME));
    away.roster().forEach(p -> playerSide.put(p.id(), Side.AWAY));
    var homeCoach = new Coach(new CoachId(new UUID(1L, 1L)), "Home HC");
    var awayCoach = new Coach(new CoachId(new UUID(1L, 2L)), "Away HC");

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
              BandPuntResolver.load(repo, sampler));
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
    reportBand(report, "pass_yards", passYards, loadBand(repo, "pass_yards"), 40, 30, 40);
    reportBand(report, "rush_yards", rushYards, loadBand(repo, "rush_yards"), 30, 20, 30);
    reportBand(report, "plays", plays, loadBand(repo, "plays"), 6, 4, 6);
    reportBand(report, "sacks_taken", sacks, loadBand(repo, "sacks_taken"), 2, 2, 2);
    reportBand(report, "interceptions", interceptions, loadBand(repo, "interceptions"), 1, 1, 1);
    reportBand(report, "fumbles_lost", fumbles, loadBand(repo, "fumbles_lost"), 1, 1, 1);
    System.out.println(report);
  }

  private static DistributionalBand loadBand(ClasspathBandRepository repo, String key) {
    return repo.loadDistribution("team-game.json", "bands." + key);
  }

  private static void reportBand(
      StringBuilder out,
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
            cell(sorted, 0.10, ladder.get(0.10).intValue(), tolP10),
            cell(sorted, 0.50, ladder.get(0.50).intValue(), tolP50),
            cell(sorted, 0.90, ladder.get(0.90).intValue(), tolP90)));
  }

  private static String cell(int[] sorted, double p, int target, int tol) {
    var obs = sorted[(int) Math.round(p * (sorted.length - 1))];
    var drift = Math.abs(obs - target) > tol ? " DRIFT" : "";
    return "%d/%d/%d%s".formatted(obs, target, tol, drift);
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
      case PlayEvent.Scramble s -> stats.addPlay(playerSide.get(s.qb()));
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
    public PlayCall call(GameState state) {
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
    for (var i = 0; i < count; i++) {
      var id = new PlayerId(new UUID(idSeed, i));
      var name = "%s %s%d".formatted(label, position.name(), i + 1);
      out.add(new Player(id, position, name));
    }
  }
}
