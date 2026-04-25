package app.zoneblitz.gamesimulator.clockmgmt;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.event.DownAndDistance;
import app.zoneblitz.gamesimulator.event.FieldPosition;
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

class TendencyTimeoutDeciderTests {

  private static final Coach HOME_COACH =
      Coach.average(new CoachId(new UUID(1L, 1L)), "Home Coach");
  private static final Coach AWAY_COACH =
      Coach.average(new CoachId(new UUID(1L, 2L)), "Away Coach");

  private final TimeoutDecider decider = new TendencyTimeoutDecider();

  @Test
  void decide_outsideLateHalfWindow_returnsEmpty() {
    var state = stateWith(1, 10 * 60, new Score(0, 0), Side.HOME);

    var result = decider.decide(state, HOME_COACH, AWAY_COACH, new ConstantRandomSource(0.0));

    assertThat(result).isEmpty();
  }

  @Test
  void decide_lateFourthTrailingDefense_callsTimeoutForDefense() {
    var state = stateWith(4, 90, new Score(7, 14), Side.AWAY);

    var result = decider.decide(state, HOME_COACH, AWAY_COACH, new ConstantRandomSource(0.0));

    assertThat(result).contains(Side.HOME);
  }

  @Test
  void decide_whenSideHasZeroTimeouts_doesNotCallForThatSide() {
    var base = stateWith(4, 90, new Score(7, 14), Side.AWAY);
    var noHomeTimeouts =
        base.withTimeoutUsed(Side.HOME).withTimeoutUsed(Side.HOME).withTimeoutUsed(Side.HOME);

    var result =
        decider.decide(noHomeTimeouts, HOME_COACH, AWAY_COACH, new ConstantRandomSource(0.0));

    assertThat(result).isNotEqualTo(java.util.Optional.of(Side.HOME));
  }

  @Test
  void decide_lateFourthWithLeadingDefense_fallsThroughToTrailingOffense() {
    var state = stateWith(4, 90, new Score(21, 7), Side.AWAY);

    var result = decider.decide(state, HOME_COACH, AWAY_COACH, new ConstantRandomSource(0.0));

    assertThat(result).contains(Side.AWAY);
  }

  @Test
  void decide_lateFourthNeitherTrailing_returnsEmpty() {
    var state = stateWith(4, 90, new Score(14, 14), Side.AWAY);

    var result = decider.decide(state, HOME_COACH, AWAY_COACH, new ConstantRandomSource(0.99));

    assertThat(result).isEmpty();
  }

  @Test
  void decide_whenRngHigh_doesNotFire() {
    var state = stateWith(4, 90, new Score(7, 14), Side.AWAY);

    var result = decider.decide(state, HOME_COACH, AWAY_COACH, new ConstantRandomSource(0.999));

    assertThat(result).isEmpty();
  }

  @Test
  void decide_highQualityTrailingDefense_firesWhereNeutralWouldNot() {
    // Neutral clockAwareness=50 → fireRate = 0.45 * 1.0 = 0.45.
    // Neutral quality=50 → multiplier 1.0; high quality=100 → multiplier 1.2; rate = 0.54.
    // RNG 0.50 is above 0.45 (neutral doesn't fire) but below 0.54 (high quality fires).
    var state = stateWith(4, 90, new Score(7, 14), Side.AWAY);
    var highQualityHome = coachWithQuality(100);
    var rng = new ConstantRandomSource(0.50);

    assertThat(decider.decide(state, HOME_COACH, AWAY_COACH, rng)).isEmpty();
    assertThat(decider.decide(state, highQualityHome, AWAY_COACH, rng)).contains(Side.HOME);
  }

  @Test
  void decide_lowQualityTiedLateSecondQuarter_wastesTimeout() {
    // Tied Q2 final 2 minutes: no legitimate window (not tied-late-Q4, no trailing side).
    // Quality=0 → wrongWindowFireRate = 0.02. RNG 0.01 < 0.02 → wastes a timeout.
    var state = stateWith(2, 90, new Score(14, 14), Side.AWAY);
    var dumbHome = coachWithQuality(0);
    var dumbAway = coachWithQuality(0);

    var result = decider.decide(state, dumbHome, dumbAway, new ConstantRandomSource(0.01));

    // Defense-side is consulted first in the wrong-window branch.
    assertThat(result).contains(Side.HOME);
  }

  @Test
  void decide_neutralQualityTiedLateSecondQuarter_doesNotWasteTimeout() {
    // Same wrong-window situation but neutral quality=50 → wrongWindowFireRate = 0.
    var state = stateWith(2, 90, new Score(14, 14), Side.AWAY);

    var result = decider.decide(state, HOME_COACH, AWAY_COACH, new ConstantRandomSource(0.001));

    assertThat(result).isEmpty();
  }

  private static Coach coachWithQuality(int decisionQuality) {
    return new Coach(
        new CoachId(new UUID(13L, decisionQuality)),
        "Q-" + decisionQuality,
        CoachTendencies.average(),
        DefensiveCoachTendencies.average(),
        new CoachQuality(decisionQuality, 50));
  }

  private static GameState stateWith(int quarter, int seconds, Score score, Side possession) {
    var base = GameState.initial();
    return new GameState(
        score,
        new GameClock(quarter, seconds),
        new DownAndDistance(1, 10),
        new FieldPosition(25),
        possession,
        base.drive(),
        base.fatigueSnapCounts(),
        base.injuredPlayers(),
        base.homeTimeouts(),
        base.awayTimeouts(),
        base.phase(),
        base.overtimeRound(),
        base.overtime());
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
