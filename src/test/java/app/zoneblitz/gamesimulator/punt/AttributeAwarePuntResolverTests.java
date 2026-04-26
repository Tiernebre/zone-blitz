package app.zoneblitz.gamesimulator.punt;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.band.ClasspathBandRepository;
import app.zoneblitz.gamesimulator.band.DefaultBandSampler;
import app.zoneblitz.gamesimulator.event.DownAndDistance;
import app.zoneblitz.gamesimulator.event.FieldPosition;
import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.PuntResult;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.event.TeamId;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import app.zoneblitz.gamesimulator.roster.Physical;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Skill;
import app.zoneblitz.gamesimulator.roster.Team;
import app.zoneblitz.gamesimulator.roster.Tendencies;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AttributeAwarePuntResolverTests {

  private static final Team RECEIVING =
      new Team(
          new TeamId(new UUID(2L, 2L)),
          "Recv",
          List.of(
              new Player(new PlayerId(new UUID(2L, 20L)), Position.WR, "Returner"),
              new Player(new PlayerId(new UUID(2L, 21L)), Position.CB, "CB")));
  private static final GameId GAME = new GameId(new UUID(9L, 9L));

  @Test
  void resolve_elitePower_increasesAverageGrossYards() {
    var elite = kickingTeamWithPunter(skillWith(95, 50, 50));
    var weak = kickingTeamWithPunter(skillWith(15, 50, 50));

    var resolver = new AttributeAwarePuntResolver(distanceCurveDelegate());

    var eliteAvg = averageGross(resolver, elite, 1_000);
    var weakAvg = averageGross(resolver, weak, 1_000);

    assertThat(eliteAvg - weakAvg)
        .as("elite leg should outdrive weak leg by several yards over 1000 punts")
        .isGreaterThan(3.0);
  }

  @Test
  void resolve_eliteHangTime_reducesAverageReturnYards() {
    var elite = kickingTeamWithPunter(skillWith(50, 50, 95));
    var weak = kickingTeamWithPunter(skillWith(50, 50, 15));

    var resolver = new AttributeAwarePuntResolver(bandDelegate());

    var eliteReturn = averageReturnYards(resolver, elite, 2_000);
    var weakReturn = averageReturnYards(resolver, weak, 2_000);

    assertThat(weakReturn).isGreaterThan(eliteReturn);
  }

  @Test
  void resolve_eliteAccuracy_flipsSomeTouchbacksToPins() {
    var elite = kickingTeamWithPunter(skillWith(50, 95, 50));
    var resolver = new AttributeAwarePuntResolver(bandDelegate());

    // Punt from opponent territory (LOS=70) so touchbacks are common in the band distribution.
    var touchbacks = 0;
    var downedAtPin = 0;
    for (var i = 0; i < 2_000; i++) {
      var resolved =
          resolver.resolve(
              elite,
              RECEIVING,
              Side.HOME,
              GAME,
              i,
              new FieldPosition(70),
              new DownAndDistance(4, 8),
              new GameClock(2, 120),
              new Score(0, 0),
              new SplittableRandomSource(98765L + i));
      var result = resolved.event().result();
      if (result == PuntResult.TOUCHBACK) {
        touchbacks++;
      } else if (result == PuntResult.DOWNED && resolved.nextSpotYardLine() == 5) {
        downedAtPin++;
      }
    }

    assertThat(downedAtPin)
        .as("elite-accuracy punter should convert some touchbacks into 5-yard-line pins")
        .isGreaterThan(0);
    assertThat(touchbacks)
        .as("not every touchback flips — most still pass through")
        .isGreaterThan(downedAtPin);
  }

  @Test
  void resolve_blockedOutcome_passesThroughUnchanged() {
    var elite = kickingTeamWithPunter(skillWith(95, 95, 95));
    var blockedDelegate = forcedOutcomeDelegate(PuntResult.BLOCKED, /* gross */ 0, /* return */ 0);
    var resolver = new AttributeAwarePuntResolver(blockedDelegate);

    var resolved =
        resolver.resolve(
            elite,
            RECEIVING,
            Side.HOME,
            GAME,
            0,
            new FieldPosition(30),
            new DownAndDistance(4, 8),
            new GameClock(2, 120),
            new Score(0, 0),
            new SplittableRandomSource(1L));

    assertThat(resolved.event().result()).isEqualTo(PuntResult.BLOCKED);
    assertThat(resolved.event().grossYards()).isZero();
  }

  @Test
  void resolve_averagePunter_neutralOnDelegate() {
    var team = kickingTeamWithPunter(Skill.average());
    var delegate = bandDelegate();
    var resolver = new AttributeAwarePuntResolver(delegate);

    var base =
        delegate.resolve(
            team,
            RECEIVING,
            Side.HOME,
            GAME,
            0,
            new FieldPosition(30),
            new DownAndDistance(4, 8),
            new GameClock(2, 120),
            new Score(0, 0),
            new SplittableRandomSource(123L));
    var decorated =
        resolver.resolve(
            team,
            RECEIVING,
            Side.HOME,
            GAME,
            0,
            new FieldPosition(30),
            new DownAndDistance(4, 8),
            new GameClock(2, 120),
            new Score(0, 0),
            new SplittableRandomSource(123L));

    assertThat(decorated.event().grossYards()).isEqualTo(base.event().grossYards());
    assertThat(decorated.event().returnYards()).isEqualTo(base.event().returnYards());
    assertThat(decorated.event().result()).isEqualTo(base.event().result());
    assertThat(decorated.nextSpotYardLine()).isEqualTo(base.nextSpotYardLine());
  }

  private static double averageGross(PuntResolver resolver, Team team, int iterations) {
    var sum = 0L;
    var counted = 0;
    for (var i = 0; i < iterations; i++) {
      var resolved =
          resolver.resolve(
              team,
              RECEIVING,
              Side.HOME,
              GAME,
              i,
              new FieldPosition(30),
              new DownAndDistance(4, 8),
              new GameClock(2, 120),
              new Score(0, 0),
              new SplittableRandomSource(2024L + i));
      if (resolved.event().result() != PuntResult.BLOCKED) {
        sum += resolved.event().grossYards();
        counted++;
      }
    }
    return counted == 0 ? 0.0 : sum / (double) counted;
  }

  private static double averageReturnYards(PuntResolver resolver, Team team, int iterations) {
    var sum = 0L;
    var counted = 0;
    for (var i = 0; i < iterations; i++) {
      var resolved =
          resolver.resolve(
              team,
              RECEIVING,
              Side.HOME,
              GAME,
              i,
              new FieldPosition(30),
              new DownAndDistance(4, 8),
              new GameClock(2, 120),
              new Score(0, 0),
              new SplittableRandomSource(31337L + i));
      if (resolved.event().result() == PuntResult.RETURNED) {
        sum += resolved.event().returnYards();
        counted++;
      }
    }
    return counted == 0 ? 0.0 : sum / (double) counted;
  }

  private static PuntResolver bandDelegate() {
    return BandPuntResolver.load(new ClasspathBandRepository(), new DefaultBandSampler());
  }

  private static PuntResolver distanceCurveDelegate() {
    return new DistanceCurvePuntResolver();
  }

  private static PuntResolver forcedOutcomeDelegate(PuntResult result, int gross, int returnY) {
    return (kickingTeam,
        receivingTeam,
        kickingSide,
        gameId,
        sequence,
        preSnapSpot,
        preSnap,
        clock,
        scoreAfter,
        rng) -> {
      var punter = kickingTeam.roster().get(0).id();
      var receivingSide = kickingSide == Side.HOME ? Side.AWAY : Side.HOME;
      var event =
          new app.zoneblitz.gamesimulator.event.PlayEvent.Punt(
              new app.zoneblitz.gamesimulator.event.PlayId(
                  new UUID(gameId.value().getMostSignificantBits(), 0xAAA0L | sequence)),
              gameId,
              sequence,
              preSnap,
              preSnapSpot,
              clock,
              clock,
              scoreAfter,
              punter,
              gross,
              java.util.Optional.empty(),
              returnY,
              result);
      return new PuntResolver.Resolved(event, receivingSide, 1);
    };
  }

  private static Team kickingTeamWithPunter(Skill skill) {
    var punter =
        new Player(
            new PlayerId(new UUID(1L, 10L)),
            Position.P,
            "Punter",
            Physical.average(),
            skill,
            Tendencies.average());
    return new Team(new TeamId(new UUID(1L, 1L)), "Kick", List.of(punter));
  }

  private static Skill skillWith(int puntPower, int puntAccuracy, int puntHangTime) {
    return new Skill(
        50,
        50,
        50,
        50,
        50,
        50,
        50,
        50,
        50,
        50,
        50,
        50,
        puntPower,
        puntAccuracy,
        puntHangTime,
        50,
        50,
        50,
        50,
        50,
        50,
        50,
        50,
        50,
        50,
        50,
        50,
        50,
        50);
  }
}
