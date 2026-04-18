package app.zoneblitz.gamesimulator.penalty;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.event.DownAndDistance;
import app.zoneblitz.gamesimulator.event.PenaltyType;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.Side;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class PenaltyEnforcerTests {

  private static final PlayerId SOMEONE = new PlayerId(new UUID(1L, 1L));

  @Test
  void preSnapAgainstOffense_replaysDownAndMovesSpotBackward() {
    var preSnap = new DownAndDistance(2, 8);
    var draw =
        new PenaltyDraw.PreSnap(
            PenaltyType.FALSE_START, Side.HOME, SOMEONE, 5, PenaltyEnforcement.preSnap());

    var applied = PenaltyEnforcer.apply(preSnap, 40, 40, Side.HOME, draw);

    assertThat(applied).isInstanceOf(PenaltyEnforcer.Applied.Next.class);
    var next = (PenaltyEnforcer.Applied.Next) applied;
    assertThat(next.newSpot().yardLine()).isEqualTo(35);
    assertThat(next.nextDownAndDistance()).isEqualTo(new DownAndDistance(2, 13));
  }

  @Test
  void preSnapAgainstDefense_replaysDownAndMovesSpotForward() {
    var preSnap = new DownAndDistance(3, 7);
    var draw =
        new PenaltyDraw.PreSnap(
            PenaltyType.OFFSIDE, Side.AWAY, SOMEONE, 5, PenaltyEnforcement.preSnap());

    var applied = PenaltyEnforcer.apply(preSnap, 40, 40, Side.HOME, draw);

    var next = (PenaltyEnforcer.Applied.Next) applied;
    assertThat(next.newSpot().yardLine()).isEqualTo(45);
    assertThat(next.nextDownAndDistance()).isEqualTo(new DownAndDistance(3, 2));
  }

  @Test
  void preSnapDefensiveFoul_pastMarker_awardsFirstDown() {
    var preSnap = new DownAndDistance(4, 2);
    var draw =
        new PenaltyDraw.PreSnap(
            PenaltyType.OFFSIDE, Side.AWAY, SOMEONE, 5, PenaltyEnforcement.preSnap());

    var applied = PenaltyEnforcer.apply(preSnap, 40, 40, Side.HOME, draw);

    var next = (PenaltyEnforcer.Applied.Next) applied;
    assertThat(next.newSpot().yardLine()).isEqualTo(45);
    assertThat(next.nextDownAndDistance()).isEqualTo(new DownAndDistance(1, 10));
  }

  @Test
  void defensivePassInterference_givesAutoFirstDownAtSpot() {
    var preSnap = new DownAndDistance(2, 12);
    var draw =
        new PenaltyDraw.LiveBall(
            PenaltyType.PASS_INTERFERENCE_DEFENSE,
            Side.AWAY,
            SOMEONE,
            20,
            PenaltyEnforcement.defensiveSpotFoul());

    var applied = PenaltyEnforcer.apply(preSnap, 30, 30, Side.HOME, draw);

    var next = (PenaltyEnforcer.Applied.Next) applied;
    assertThat(next.newSpot().yardLine()).isEqualTo(50);
    assertThat(next.nextDownAndDistance()).isEqualTo(new DownAndDistance(1, 10));
  }

  @Test
  void offensivePassInterference_onFourthDown_returnsTurnoverOnDowns() {
    var preSnap = new DownAndDistance(4, 3);
    var draw =
        new PenaltyDraw.LiveBall(
            PenaltyType.PASS_INTERFERENCE_OFFENSE,
            Side.HOME,
            SOMEONE,
            10,
            PenaltyEnforcement.offenseLossOfDown());

    var applied = PenaltyEnforcer.apply(preSnap, 50, 50, Side.HOME, draw);

    assertThat(applied).isInstanceOf(PenaltyEnforcer.Applied.TurnoverOnDowns.class);
    var turnover = (PenaltyEnforcer.Applied.TurnoverOnDowns) applied;
    assertThat(turnover.newSpot().yardLine()).isEqualTo(40);
  }

  @Test
  void halfDistanceToGoal_capsYardageWhenInsideOwnTen() {
    var preSnap = new DownAndDistance(1, 10);
    var draw =
        new PenaltyDraw.PreSnap(
            PenaltyType.HOLDING_OFFENSE, Side.HOME, SOMEONE, 10, PenaltyEnforcement.preSnap());

    var applied = PenaltyEnforcer.apply(preSnap, 6, 6, Side.HOME, draw);

    var next = (PenaltyEnforcer.Applied.Next) applied;
    // Half-distance from own 6-yard line: max 3 yards applied (6/2).
    assertThat(next.newSpot().yardLine()).isEqualTo(3);
    assertThat(next.yardsApplied()).isEqualTo(3);
  }

  @Test
  void roughingThePasser_enforcedFromEndOfPlay_withAutoFirstDown() {
    var preSnap = new DownAndDistance(2, 10);
    var draw =
        new PenaltyDraw.LiveBall(
            PenaltyType.ROUGHING_THE_PASSER,
            Side.AWAY,
            SOMEONE,
            15,
            PenaltyEnforcement.personalFoulOnDefense());

    var applied = PenaltyEnforcer.apply(preSnap, 30, 45, Side.HOME, draw);

    var next = (PenaltyEnforcer.Applied.Next) applied;
    assertThat(next.newSpot().yardLine()).isEqualTo(60);
    assertThat(next.nextDownAndDistance()).isEqualTo(new DownAndDistance(1, 10));
  }
}
