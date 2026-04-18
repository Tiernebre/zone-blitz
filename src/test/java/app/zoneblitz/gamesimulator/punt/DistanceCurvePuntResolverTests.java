package app.zoneblitz.gamesimulator.punt;

import static org.assertj.core.api.Assertions.assertThat;

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
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Team;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class DistanceCurvePuntResolverTests {

  private static final PlayerId PUNTER_ID = new PlayerId(new UUID(1L, 1L));
  private static final PlayerId RETURNER_ID = new PlayerId(new UUID(2L, 1L));
  private static final Team KICKING =
      new Team(
          new TeamId(new UUID(1L, 0L)),
          "Kicking",
          List.of(new Player(PUNTER_ID, Position.P, "Punter")));
  private static final Team RECEIVING =
      new Team(
          new TeamId(new UUID(2L, 0L)),
          "Receiving",
          List.of(new Player(RETURNER_ID, Position.WR, "Returner")));
  private static final GameId GAME = new GameId(new UUID(9L, 9L));
  private static final DownAndDistance FOURTH_AND_TEN = new DownAndDistance(4, 10);
  private static final GameClock CLOCK = new GameClock(4, 120);
  private static final Score SCORE = new Score(7, 3);

  @Test
  void resolve_longPuntLandingInEndZone_isTouchbackAtReceiverTwenty() {
    var resolver = new DistanceCurvePuntResolver((los, rng) -> 100);

    var resolved =
        resolver.resolve(
            KICKING,
            RECEIVING,
            Side.HOME,
            GAME,
            0,
            new FieldPosition(30),
            FOURTH_AND_TEN,
            CLOCK,
            SCORE,
            new SplittableRandomSource(0L));

    assertThat(resolved.event().result()).isEqualTo(PuntResult.TOUCHBACK);
    assertThat(resolved.event().returner()).isEmpty();
    assertThat(resolved.event().returnYards()).isZero();
    assertThat(resolved.event().grossYards()).isEqualTo(70);
    assertThat(resolved.receivingTakeoverYardLine()).isEqualTo(20);
  }

  @Test
  void resolve_puntInsideTen_mostlyDownedAtLandingSpot() {
    var resolver = new DistanceCurvePuntResolver((los, rng) -> 65); // LOS 30 → landing 95 → recv 5

    var resolved =
        resolver.resolve(
            KICKING,
            RECEIVING,
            Side.HOME,
            GAME,
            0,
            new FieldPosition(30),
            FOURTH_AND_TEN,
            CLOCK,
            SCORE,
            new SplittableRandomSource(1L));

    assertThat(resolved.event().result())
        .isIn(PuntResult.DOWNED, PuntResult.FAIR_CATCH, PuntResult.RETURNED);
    assertThat(resolved.receivingTakeoverYardLine()).isLessThanOrEqualTo(15);
    assertThat(resolved.event().grossYards()).isEqualTo(65);
  }

  @Test
  void resolve_midfieldPunt_spotsDefenseAtLandingPlusReturn() {
    var resolver = new DistanceCurvePuntResolver((los, rng) -> 45); // LOS 25 → landing 70 → recv 30

    var resolved =
        resolver.resolve(
            KICKING,
            RECEIVING,
            Side.HOME,
            GAME,
            0,
            new FieldPosition(25),
            FOURTH_AND_TEN,
            CLOCK,
            SCORE,
            new SplittableRandomSource(3L));

    assertThat(resolved.event().result()).isNotEqualTo(PuntResult.TOUCHBACK);
    var expectedFloor = 30;
    var expectedCeiling = 30 + 14;
    assertThat(resolved.receivingTakeoverYardLine()).isBetween(expectedFloor, expectedCeiling);
    assertThat(resolved.event().grossYards()).isEqualTo(45);
  }

  @Test
  void resolve_eventIsStampedWithPunterFromKickingTeam() {
    var resolver = new DistanceCurvePuntResolver((los, rng) -> 40);

    var resolved =
        resolver.resolve(
            KICKING,
            RECEIVING,
            Side.HOME,
            GAME,
            7,
            new FieldPosition(25),
            FOURTH_AND_TEN,
            CLOCK,
            SCORE,
            new SplittableRandomSource(42L));

    assertThat(resolved.event().punter()).isEqualTo(PUNTER_ID);
    assertThat(resolved.event().sequence()).isEqualTo(7);
    assertThat(resolved.event().scoreAfter()).isEqualTo(SCORE);
  }

  @Test
  void baselineGrossYards_deepInOwnTerritory_meansAroundFortyFive() {
    var total = 0;
    var rng = new SplittableRandomSource(0L);
    var trials = 5_000;
    for (var i = 0; i < trials; i++) {
      total += DistanceCurvePuntResolver.baselineGrossYards(25, rng);
    }
    var mean = total / (double) trials;
    assertThat(mean).isBetween(40.0, 50.0);
  }

  @Test
  void baselineGrossYards_deepInOpponentTerritory_tapersToFitField() {
    var rng = new SplittableRandomSource(0L);
    for (var i = 0; i < 1_000; i++) {
      var gross = DistanceCurvePuntResolver.baselineGrossYards(70, rng);
      // From LOS 70, gross > 40 would kick out the back consistently; sampler should avoid that.
      assertThat(gross).isLessThanOrEqualTo(40);
    }
  }
}
