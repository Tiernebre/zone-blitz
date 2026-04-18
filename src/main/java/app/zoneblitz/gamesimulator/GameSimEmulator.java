package app.zoneblitz.gamesimulator;

import app.zoneblitz.gamesimulator.band.ClasspathBandRepository;
import app.zoneblitz.gamesimulator.band.DefaultBandSampler;
import app.zoneblitz.gamesimulator.clock.BandClockModel;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.event.TeamId;
import app.zoneblitz.gamesimulator.kickoff.TouchbackKickoffResolver;
import app.zoneblitz.gamesimulator.output.NarrationContext;
import app.zoneblitz.gamesimulator.output.PlayNarrator;
import app.zoneblitz.gamesimulator.personnel.BaselinePersonnelSelector;
import app.zoneblitz.gamesimulator.resolver.DispatchingPlayResolver;
import app.zoneblitz.gamesimulator.resolver.pass.MatchupPassResolver;
import app.zoneblitz.gamesimulator.resolver.run.MatchupRunResolver;
import app.zoneblitz.gamesimulator.roster.Coach;
import app.zoneblitz.gamesimulator.roster.CoachId;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Team;
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

    var home = buildTeam("HOME", 100);
    var away = buildTeam("AWAY", 200);

    var repo = new ClasspathBandRepository();
    var sampler = new DefaultBandSampler();
    var resolver =
        new DispatchingPlayResolver(
            MatchupPassResolver.load(repo, sampler), MatchupRunResolver.load(repo, sampler));

    var simulator =
        new GameSimulator(
            new AlternatingPlayCaller(),
            new BaselinePersonnelSelector(),
            resolver,
            BandClockModel.load(repo, sampler),
            new TouchbackKickoffResolver());

    var inputs =
        new GameInputs(
            new GameId(new UUID(0xDEADBEEFL, seed)),
            home,
            away,
            new Coach(new CoachId(new UUID(1L, 1L)), "Home HC"),
            new Coach(new CoachId(new UUID(1L, 2L)), "Away HC"),
            new GameInputs.PreGameContext(),
            Optional.of(seed));

    var names = new HashMap<PlayerId, String>();
    home.roster().forEach(p -> names.put(p.id(), p.displayName()));
    away.roster().forEach(p -> names.put(p.id(), p.displayName()));
    var context =
        new NarrationContext(
            id -> Optional.ofNullable(names.get(id)),
            side -> side == Side.HOME ? home.displayName() : away.displayName());
    var narrator = PlayNarrator.defaultNarrator();

    System.out.println("Zone Blitz emulator — seed=" + seed);
    simulator
        .simulate(inputs)
        .forEach(event -> System.out.println(narrator.narrate(event, context)));
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

  private static final class AlternatingPlayCaller implements PlayCaller {
    private int n;

    @Override
    public PlayCall call(GameState state) {
      return new PlayCall((n++ % 2 == 0) ? "run" : "pass");
    }
  }
}
