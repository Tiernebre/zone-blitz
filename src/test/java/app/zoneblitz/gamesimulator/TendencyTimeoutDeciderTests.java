package app.zoneblitz.gamesimulator;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.event.DownAndDistance;
import app.zoneblitz.gamesimulator.event.FieldPosition;
import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Coach;
import app.zoneblitz.gamesimulator.roster.CoachId;
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
