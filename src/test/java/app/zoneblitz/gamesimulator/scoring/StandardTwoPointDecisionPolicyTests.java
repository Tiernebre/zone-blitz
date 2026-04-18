package app.zoneblitz.gamesimulator.scoring;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.Side;
import org.junit.jupiter.api.Test;

class StandardTwoPointDecisionPolicyTests {

  private final TwoPointDecisionPolicy policy = new StandardTwoPointDecisionPolicy();

  @Test
  void goForTwo_earlyGame_returnsFalseEvenWhenTrailingByCatchUpNumber() {
    // Home just scored a TD; now trailing by 2 (AWAY 8, HOME 6). Q1 — no late-game pressure.
    var score = new Score(6, 8);

    var result = policy.goForTwo(score, Side.HOME, new GameClock(1, 10 * 60));

    assertThat(result).isFalse();
  }

  @Test
  void goForTwo_lateFourthAndDownByTwo_returnsTrue() {
    // Away trailing by 2 after TD in final 2 minutes — canonical "go for the tie".
    var score = new Score(21, 19);

    var result = policy.goForTwo(score, Side.AWAY, new GameClock(4, 90));

    assertThat(result).isTrue();
  }

  @Test
  void goForTwo_lateFourthAndDownByFive_returnsTrue() {
    var score = new Score(14, 9);

    var result = policy.goForTwo(score, Side.AWAY, new GameClock(4, 4 * 60));

    assertThat(result).isTrue();
  }

  @Test
  void goForTwo_lateFourthAndDownByNine_returnsTrue() {
    var score = new Score(24, 15);

    var result = policy.goForTwo(score, Side.AWAY, new GameClock(4, 60));

    assertThat(result).isTrue();
  }

  @Test
  void goForTwo_lateFourthAndLeading_returnsFalse() {
    var score = new Score(21, 7);

    var result = policy.goForTwo(score, Side.HOME, new GameClock(4, 90));

    assertThat(result).isFalse();
  }

  @Test
  void goForTwo_lateFourthButTrailingByNonCatchUpDeficit_returnsFalse() {
    // Down 3 after TD is not a canonical catch-up number — a PAT keeps it a field-goal game.
    var score = new Score(7, 10);

    var result = policy.goForTwo(score, Side.HOME, new GameClock(4, 60));

    assertThat(result).isFalse();
  }

  @Test
  void goForTwo_lateOvertimeAndDownByTwo_returnsTrue() {
    // Late-game window also applies to overtime periods.
    var score = new Score(24, 22);

    var result = policy.goForTwo(score, Side.AWAY, new GameClock(5, 60));

    assertThat(result).isTrue();
  }

  @Test
  void goForTwo_fourthQuarterButEarlyInIt_returnsFalse() {
    // 10:00 left in Q4 is outside the "late-game" 5:00 window.
    var score = new Score(6, 8);

    var result = policy.goForTwo(score, Side.HOME, new GameClock(4, 10 * 60));

    assertThat(result).isFalse();
  }
}
