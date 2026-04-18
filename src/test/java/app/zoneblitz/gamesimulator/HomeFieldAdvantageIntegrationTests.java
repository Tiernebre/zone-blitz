package app.zoneblitz.gamesimulator;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.band.ClasspathBandRepository;
import app.zoneblitz.gamesimulator.band.DefaultBandSampler;
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
import app.zoneblitz.gamesimulator.playcalling.DefensiveCallSelector;
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
import app.zoneblitz.gamesimulator.scoring.FlatRateTwoPointResolver;
import app.zoneblitz.gamesimulator.scoring.StandardTwoPointDecisionPolicy;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Random;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * Sim-level integration tests for {@link HomeFieldModel}. Runs a modest batch of full games with
 * two evenly-matched rosters, and verifies that at extreme stadium strength the road team takes
 * more pre-snap penalties and scores fewer points than at neutral field. Full league-wide win-rate
 * calibration (~57%) runs in the separate {@code @Tag("calibration")} harness.
 */
class HomeFieldAdvantageIntegrationTests {

  private static final int GAMES = 400;
  private static final double PASS_RATE = 0.5793;

  @Test
  void simulate_loudStadium_roadTeamTakesMoreFalseStartsThanNeutralField() {
    var loud = simulateBatch(new HomeFieldAdvantage(100));
    var neutral = simulateBatch(HomeFieldAdvantage.neutral());

    assertThat(loud.roadFalseStartAndDelay)
        .as("road pre-snap crowd-noise flags should rise with stadium strength")
        .isGreaterThan(neutral.roadFalseStartAndDelay);
  }

  @Test
  void simulate_loudStadium_tiltsScoringSpreadTowardHomeVsNeutral() {
    var loud = simulateBatch(new HomeFieldAdvantage(100));
    var neutral = simulateBatch(HomeFieldAdvantage.neutral());

    var pairedDelta = 0L;
    for (var g = 0; g < GAMES; g++) {
      var loudSpread = loud.homeByGame[g] - loud.roadByGame[g];
      var neutralSpread = neutral.homeByGame[g] - neutral.roadByGame[g];
      pairedDelta += loudSpread - neutralSpread;
    }
    assertThat(pairedDelta)
        .as("loud stadium should tilt the home-minus-road spread upward vs a neutral field")
        .isPositive();
  }

  private BatchResult simulateBatch(HomeFieldAdvantage hfa) {
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
    var homeCoach = Coach.average(new CoachId(new UUID(1L, 1L)), "Home HC");
    var awayCoach = Coach.average(new CoachId(new UUID(1L, 2L)), "Away HC");

    var homeByGame = new int[GAMES];
    var roadByGame = new int[GAMES];
    long roadFalseStartAndDelay = 0;
    for (var g = 0; g < GAMES; g++) {
      var seed = 0xF1E1DL + g;
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
              new FlatRateTwoPointResolver(),
              new DefaultHomeFieldModel(),
              new TendencyTimeoutDecider());
      var inputs =
          new GameInputs(
              new GameId(new UUID(0xF1E1DBEEFL, seed)),
              home,
              away,
              homeCoach,
              awayCoach,
              new GameInputs.PreGameContext(hfa, Weather.indoor(), Surface.GRASS, Roof.DOME),
              Optional.of(seed));
      var lastScore = new Score[] {new Score(0, 0)};
      for (var ev : simulator.simulate(inputs).toList()) {
        lastScore[0] = ev.scoreAfter();
        if (ev instanceof PlayEvent.Penalty p
            && p.against() == Side.AWAY
            && (p.type() == app.zoneblitz.gamesimulator.event.PenaltyType.FALSE_START
                || p.type() == app.zoneblitz.gamesimulator.event.PenaltyType.DELAY_OF_GAME)) {
          roadFalseStartAndDelay++;
        }
      }
      homeByGame[g] = lastScore[0].home();
      roadByGame[g] = lastScore[0].away();
    }
    return new BatchResult(homeByGame, roadByGame, roadFalseStartAndDelay);
  }

  private record BatchResult(int[] homeByGame, int[] roadByGame, long roadFalseStartAndDelay) {}

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

  private static final class BandPassRateCaller implements PlayCaller {
    private final double passRate;
    private final Random rng;

    BandPassRateCaller(double passRate, Random rng) {
      this.passRate = passRate;
      this.rng = rng;
    }

    @Override
    public PlayCall call(
        GameState state, Coach coach, app.zoneblitz.gamesimulator.rng.RandomSource rs) {
      return new PlayCall(rng.nextDouble() < passRate ? "pass" : "run");
    }
  }
}
