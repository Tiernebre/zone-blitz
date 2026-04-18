package app.zoneblitz.gamesimulator.scoring;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.event.DownAndDistance;
import app.zoneblitz.gamesimulator.event.FieldGoalResult;
import app.zoneblitz.gamesimulator.event.FieldPosition;
import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.PlayerId;
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

class DistanceCurveFieldGoalResolverTests {

  private static final Team TEAM =
      new Team(
          new TeamId(new UUID(1L, 1L)),
          "T",
          List.of(new Player(new PlayerId(new UUID(1L, 2L)), Position.K, "Kicker")));
  private static final GameId GAME = new GameId(new UUID(9L, 9L));

  @Test
  void resolve_chipShotFromOpp3_isGoodAddsThreePoints() {
    var resolver = new DistanceCurveFieldGoalResolver(d -> 1.0);

    var resolved =
        resolver.resolve(
            TEAM,
            Side.HOME,
            GAME,
            0,
            new FieldPosition(97),
            new DownAndDistance(4, 3),
            new GameClock(4, 30),
            new Score(10, 7),
            new SplittableRandomSource(0L));

    assertThat(resolved.made()).isTrue();
    assertThat(resolved.event().result()).isEqualTo(FieldGoalResult.GOOD);
    assertThat(resolved.scoreAfter()).isEqualTo(new Score(13, 7));
    assertThat(resolved.receivingTakeoverYardLine()).isEmpty();
  }

  @Test
  void resolve_missed_leavesScoreSpotsDefenseAtHoldSpot() {
    var resolver = new DistanceCurveFieldGoalResolver(d -> 0.0);

    var resolved =
        resolver.resolve(
            TEAM,
            Side.HOME,
            GAME,
            0,
            new FieldPosition(70),
            new DownAndDistance(4, 8),
            new GameClock(4, 60),
            new Score(0, 0),
            new SplittableRandomSource(1L));

    assertThat(resolved.made()).isFalse();
    assertThat(resolved.event().result()).isEqualTo(FieldGoalResult.MISSED);
    assertThat(resolved.scoreAfter()).isEqualTo(new Score(0, 0));
    // LOS at offense's yardLine=70 → hold at 63 → defense takeover at 100 - 63 = 37.
    assertThat(resolved.receivingTakeoverYardLine()).hasValue(37);
  }

  @Test
  void resolve_distance_includesEndZoneAndHoldSpot() {
    var resolver = new DistanceCurveFieldGoalResolver(d -> 1.0);

    // Ball at offense's yardLine 63 (opp 37) → 100-63+17 = 54-yard kick.
    var resolved =
        resolver.resolve(
            TEAM,
            Side.HOME,
            GAME,
            0,
            new FieldPosition(63),
            new DownAndDistance(4, 5),
            new GameClock(4, 30),
            new Score(0, 0),
            new SplittableRandomSource(0L));

    assertThat(resolved.event().distance()).isEqualTo(54);
  }

  @Test
  void baselineMakeProbability_chipShot_isNearCertain() {
    assertThat(DistanceCurveFieldGoalResolver.baselineMakeProbability(19)).isEqualTo(0.99);
  }

  @Test
  void baselineMakeProbability_longKick_linearlyDecays() {
    assertThat(DistanceCurveFieldGoalResolver.baselineMakeProbability(54)).isEqualTo(0.50);
    assertThat(DistanceCurveFieldGoalResolver.baselineMakeProbability(60)).isZero();
    assertThat(DistanceCurveFieldGoalResolver.baselineMakeProbability(61)).isZero();
  }
}
