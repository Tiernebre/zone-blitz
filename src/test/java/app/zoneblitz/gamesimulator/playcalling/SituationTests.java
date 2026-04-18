package app.zoneblitz.gamesimulator.playcalling;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.TestGameStates;
import app.zoneblitz.gamesimulator.event.Side;
import org.junit.jupiter.api.Test;

class SituationTests {

  private static app.zoneblitz.gamesimulator.GameState state(
      int down, int dist, int yardLine, int quarter, int seconds, int home, int away, Side poss) {
    return TestGameStates.of(down, dist, yardLine, quarter, seconds, home, away, poss);
  }

  @Test
  void from_bucketsShortDistance() {
    var s = Situation.from(state(2, 1, 50, 1, 600, 0, 0, Side.HOME));
    assertThat(s.distanceBucket()).isEqualTo(Situation.DistanceBucket.SHORT_1_2);
    assertThat(s.downKey()).isEqualTo("2nd");
  }

  @Test
  void from_bucketsVeryLongDistance() {
    var s = Situation.from(state(3, 15, 50, 1, 600, 0, 0, Side.HOME));
    assertThat(s.distanceBucket()).isEqualTo(Situation.DistanceBucket.VERY_LONG_11_PLUS);
  }

  @Test
  void from_bucketsFieldZoneGoalToGoInside4() {
    var s = Situation.from(state(1, 3, 97, 1, 600, 0, 0, Side.HOME));
    assertThat(s.fieldZone()).isEqualTo(Situation.FieldZone.GOAL_TO_GO);
  }

  @Test
  void from_bucketsScoreDiffFromOffensePerspective() {
    var s = Situation.from(state(1, 10, 50, 2, 600, 7, 21, Side.HOME));
    assertThat(s.scoreDiffBucket()).isEqualTo(Situation.ScoreDiffBucket.TRAILING_8_TO_14);
  }

  @Test
  void from_buckets2MinH1() {
    var s = Situation.from(state(1, 10, 50, 2, 90, 0, 0, Side.HOME));
    assertThat(s.timeBucket()).isEqualTo(Situation.TimeBucket.TWO_MIN_H1);
  }

  @Test
  void from_bucketsUnder5MinQ4() {
    var s = Situation.from(state(1, 10, 50, 4, 200, 0, 0, Side.HOME));
    assertThat(s.timeBucket()).isEqualTo(Situation.TimeBucket.UNDER_5_MIN_Q4);
  }
}
