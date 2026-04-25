package app.zoneblitz.gamesimulator.scoring;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Coach;
import app.zoneblitz.gamesimulator.roster.CoachId;
import app.zoneblitz.gamesimulator.roster.CoachQuality;
import app.zoneblitz.gamesimulator.roster.CoachTendencies;
import app.zoneblitz.gamesimulator.roster.DefensiveCoachTendencies;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class StandardTwoPointDecisionPolicyTests {

  private final TwoPointDecisionPolicy policy = new StandardTwoPointDecisionPolicy();
  private final Coach chartFollower = coachWithDecisionQuality(100);
  private final RandomSource alwaysGo = new ConstantRandomSource(0.0);

  @Test
  void goForTwo_earlyGame_returnsFalseEvenWhenTrailingByCatchUpNumber() {
    // Home just scored a TD; now trailing by 2 (AWAY 8, HOME 6). Q1 — no late-game pressure.
    var score = new Score(6, 8);

    var result =
        policy.goForTwo(score, Side.HOME, new GameClock(1, 10 * 60), chartFollower, alwaysGo);

    assertThat(result).isFalse();
  }

  @Test
  void goForTwo_lateFourthAndDownByTwo_returnsTrue() {
    // Away trailing by 2 after TD in final 2 minutes — canonical "go for the tie".
    var score = new Score(21, 19);

    var result = policy.goForTwo(score, Side.AWAY, new GameClock(4, 90), chartFollower, alwaysGo);

    assertThat(result).isTrue();
  }

  @Test
  void goForTwo_lateFourthAndDownByFive_returnsTrue() {
    var score = new Score(14, 9);

    var result =
        policy.goForTwo(score, Side.AWAY, new GameClock(4, 4 * 60), chartFollower, alwaysGo);

    assertThat(result).isTrue();
  }

  @Test
  void goForTwo_lateFourthAndDownByNine_returnsTrue() {
    var score = new Score(24, 15);

    var result = policy.goForTwo(score, Side.AWAY, new GameClock(4, 60), chartFollower, alwaysGo);

    assertThat(result).isTrue();
  }

  @Test
  void goForTwo_lateFourthAndLeading_returnsFalse() {
    var score = new Score(21, 7);

    var result = policy.goForTwo(score, Side.HOME, new GameClock(4, 90), chartFollower, alwaysGo);

    assertThat(result).isFalse();
  }

  @Test
  void goForTwo_lateFourthButTrailingByNonCatchUpDeficit_returnsFalse() {
    // Down 3 after TD is not a canonical catch-up number — a PAT keeps it a field-goal game.
    var score = new Score(7, 10);

    var result = policy.goForTwo(score, Side.HOME, new GameClock(4, 60), chartFollower, alwaysGo);

    assertThat(result).isFalse();
  }

  @Test
  void goForTwo_lateOvertimeAndDownByTwo_returnsTrue() {
    // Late-game window also applies to overtime periods.
    var score = new Score(24, 22);

    var result = policy.goForTwo(score, Side.AWAY, new GameClock(5, 60), chartFollower, alwaysGo);

    assertThat(result).isTrue();
  }

  @Test
  void goForTwo_fourthQuarterButEarlyInIt_returnsFalse() {
    // 10:00 left in Q4 is outside the "late-game" 5:00 window.
    var score = new Score(6, 8);

    var result =
        policy.goForTwo(score, Side.HOME, new GameClock(4, 10 * 60), chartFollower, alwaysGo);

    assertThat(result).isFalse();
  }

  @Test
  void goForTwo_chartSaysGoButCoachHasZeroDecisionQuality_returnsFalse() {
    var score = new Score(21, 19);
    var dumbCoach = coachWithDecisionQuality(0);

    var result = policy.goForTwo(score, Side.AWAY, new GameClock(4, 90), dumbCoach, alwaysGo);

    assertThat(result).isFalse();
  }

  @Test
  void goForTwo_chartSaysGoAndCoachHalfQualityWithLowRng_followsChart() {
    // quality 50 → 50% threshold; RNG 0.49 < 0.50 → follow chart.
    var score = new Score(21, 19);
    var midCoach = coachWithDecisionQuality(50);

    var result =
        policy.goForTwo(
            score, Side.AWAY, new GameClock(4, 90), midCoach, new ConstantRandomSource(0.49));

    assertThat(result).isTrue();
  }

  @Test
  void goForTwo_chartSaysGoAndCoachHalfQualityWithHighRng_ignoresChart() {
    // quality 50 → 50% threshold; RNG 0.51 >= 0.50 → kick.
    var score = new Score(21, 19);
    var midCoach = coachWithDecisionQuality(50);

    var result =
        policy.goForTwo(
            score, Side.AWAY, new GameClock(4, 90), midCoach, new ConstantRandomSource(0.51));

    assertThat(result).isFalse();
  }

  @Test
  void goForTwo_chartSaysNoGoAndCoachHasZeroDecisionQuality_stillReturnsFalse() {
    // Chart-negative outcomes are honoured regardless of quality (no false positives).
    var score = new Score(21, 7);

    var result =
        policy.goForTwo(
            score, Side.HOME, new GameClock(4, 90), coachWithDecisionQuality(0), alwaysGo);

    assertThat(result).isFalse();
  }

  private static Coach coachWithDecisionQuality(int decisionQuality) {
    var quality = new CoachQuality(decisionQuality, 50);
    return new Coach(
        new CoachId(new UUID(11L, decisionQuality)),
        "TwoPt-Q" + decisionQuality,
        CoachTendencies.average(),
        DefensiveCoachTendencies.average(),
        quality);
  }

  private static final class ConstantRandomSource implements RandomSource {
    private final double value;

    ConstantRandomSource(double value) {
      this.value = value;
    }

    @Override
    public long nextLong() {
      return 0L;
    }

    @Override
    public double nextDouble() {
      return value;
    }

    @Override
    public double nextGaussian() {
      return 0.0;
    }

    @Override
    public RandomSource split(long key) {
      return this;
    }
  }
}
