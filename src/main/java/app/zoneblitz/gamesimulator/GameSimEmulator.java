package app.zoneblitz.gamesimulator;

import app.zoneblitz.gamesimulator.band.ClasspathBandRepository;
import app.zoneblitz.gamesimulator.band.DefaultBandSampler;
import app.zoneblitz.gamesimulator.clock.BandClockModel;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.event.TeamId;
import app.zoneblitz.gamesimulator.kickoff.OnsideAwareKickoffResolver;
import app.zoneblitz.gamesimulator.kickoff.TouchbackKickoffResolver;
import app.zoneblitz.gamesimulator.output.NarrationContext;
import app.zoneblitz.gamesimulator.output.PlayNarrator;
import app.zoneblitz.gamesimulator.penalty.BandPenaltyModel;
import app.zoneblitz.gamesimulator.personnel.BaselinePersonnelSelector;
import app.zoneblitz.gamesimulator.playcalling.BaselineDefensiveCallSelector;
import app.zoneblitz.gamesimulator.playcalling.TendencyPlayCaller;
import app.zoneblitz.gamesimulator.punt.BandPuntResolver;
import app.zoneblitz.gamesimulator.resolver.DispatchingPlayResolver;
import app.zoneblitz.gamesimulator.resolver.pass.MatchupPassResolver;
import app.zoneblitz.gamesimulator.resolver.run.MatchupRunResolver;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import app.zoneblitz.gamesimulator.roster.Coach;
import app.zoneblitz.gamesimulator.roster.CoachId;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Team;
import app.zoneblitz.gamesimulator.scoring.DistanceCurveFieldGoalResolver;
import app.zoneblitz.gamesimulator.scoring.FlatRateExtraPointResolver;
import app.zoneblitz.gamesimulator.scoring.FlatRateTwoPointResolver;
import app.zoneblitz.gamesimulator.scoring.StandardTwoPointDecisionPolicy;
import app.zoneblitz.names.CuratedNameGenerator;
import app.zoneblitz.names.NameGenerator;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Quick-and-dirty CLI emulator: wires the sim with all-average (50-rating) rosters and prints a
 * play-by-play narration to stdout. Not production code — this is a developer smoke-test harness.
 */
public final class GameSimEmulator {

  private GameSimEmulator() {}

  public static void main(String[] args) {
    var seed =
        args.length > 0 ? Long.parseLong(args[0]) : new java.security.SecureRandom().nextLong();

    var names = CuratedNameGenerator.maleDefaults();
    var nameRng = new SplittableRandomSource(seed);
    var home = buildTeam("HOME", 100, names, nameRng.split(1));
    var away = buildTeam("AWAY", 200, names, nameRng.split(2));

    var repo = new ClasspathBandRepository();
    var sampler = new DefaultBandSampler();
    var resolver =
        new DispatchingPlayResolver(
            MatchupPassResolver.load(repo, sampler), MatchupRunResolver.load(repo, sampler));

    var simulator =
        new GameSimulator(
            TendencyPlayCaller.load(repo),
            new BaselinePersonnelSelector(),
            resolver,
            BandClockModel.load(repo, sampler),
            OnsideAwareKickoffResolver.withDefaultPolicy(new TouchbackKickoffResolver()),
            new FlatRateExtraPointResolver(),
            new DistanceCurveFieldGoalResolver(),
            BandPuntResolver.load(repo, sampler),
            new BandPenaltyModel(),
            BaselineDefensiveCallSelector.load(repo),
            new StandardTwoPointDecisionPolicy(),
            new FlatRateTwoPointResolver(),
            new DefaultHomeFieldModel());

    var inputs =
        new GameInputs(
            new GameId(new UUID(0xDEADBEEFL, seed)),
            home,
            away,
            Coach.average(new CoachId(new UUID(1L, 1L)), "Home HC"),
            Coach.average(new CoachId(new UUID(1L, 2L)), "Away HC"),
            new GameInputs.PreGameContext(HomeFieldAdvantage.leagueAverage()),
            Optional.of(seed));

    var playerNames = new HashMap<PlayerId, String>();
    home.roster().forEach(p -> playerNames.put(p.id(), p.displayName()));
    away.roster().forEach(p -> playerNames.put(p.id(), p.displayName()));
    var context =
        new NarrationContext(
            id -> Optional.ofNullable(playerNames.get(id)),
            side -> side == Side.HOME ? home.displayName() : away.displayName());
    var narrator = PlayNarrator.defaultNarrator();

    System.out.println("Zone Blitz emulator — seed=" + seed);
    simulator
        .simulate(inputs)
        .forEach(event -> System.out.println(narrator.narrate(event, context)));
  }

  private static Team buildTeam(String label, int idSeed, NameGenerator names, RandomSource rng) {
    var roster = new ArrayList<Player>();
    addPlayers(roster, Position.QB, 2, idSeed, names, rng);
    addPlayers(roster, Position.RB, 3, idSeed + 10, names, rng);
    addPlayers(roster, Position.TE, 3, idSeed + 20, names, rng);
    addPlayers(roster, Position.WR, 5, idSeed + 30, names, rng);
    addPlayers(roster, Position.OL, 8, idSeed + 40, names, rng);
    addPlayers(roster, Position.DL, 6, idSeed + 50, names, rng);
    addPlayers(roster, Position.LB, 5, idSeed + 60, names, rng);
    addPlayers(roster, Position.CB, 4, idSeed + 70, names, rng);
    addPlayers(roster, Position.S, 3, idSeed + 80, names, rng);
    addPlayers(roster, Position.K, 1, idSeed + 90, names, rng);
    addPlayers(roster, Position.P, 1, idSeed + 95, names, rng);
    return new Team(new TeamId(new UUID(9L, idSeed)), label, List.copyOf(roster));
  }

  private static void addPlayers(
      List<Player> out,
      Position position,
      int count,
      int idSeed,
      NameGenerator names,
      RandomSource rng) {
    for (var i = 0; i < count; i++) {
      var id = new PlayerId(new UUID(idSeed, i));
      out.add(new Player(id, position, names.generate(rng).display()));
    }
  }
}
