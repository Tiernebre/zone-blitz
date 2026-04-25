package app.zoneblitz.gamesimulator.clockmgmt;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.TestGameStates;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import app.zoneblitz.gamesimulator.roster.Coach;
import app.zoneblitz.gamesimulator.roster.CoachId;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class TendencyEndOfHalfDeciderTests {

  private final EndOfHalfDecider decider = new TendencyEndOfHalfDecider();
  private final Coach coach = Coach.average(new CoachId(new UUID(1L, 1L)), "coach");

  private static SplittableRandomSource rng() {
    return new SplittableRandomSource(1L);
  }

  private static GameState exhaustTimeouts(GameState state, Side side) {
    while (state.timeoutsFor(side) > 0) {
      state = state.withTimeoutUsed(side);
    }
    return state;
  }

  @Test
  void decide_winningLateQ4DefenseOutOfTimeouts_returnsKneel() {
    var state = TestGameStates.of(1, 10, 50, 4, 80, 24, 17, Side.HOME);
    state = exhaustTimeouts(state, Side.AWAY);

    var action = decider.decide(state, coach, rng());

    assertThat(action).contains(EndOfHalfDecider.Action.KNEEL);
  }

  @Test
  void decide_winningButDefenseHasTimeoutsAndTimeLeft_doesNotKneel() {
    var state = TestGameStates.of(1, 10, 50, 4, 120, 24, 17, Side.HOME);

    var action = decider.decide(state, coach, rng());

    assertThat(action).isEmpty();
  }

  @Test
  void decide_tiedLateQ4_doesNotKneel() {
    var state = TestGameStates.of(1, 10, 50, 4, 60, 14, 14, Side.HOME);
    state = exhaustTimeouts(state, Side.AWAY);

    var action = decider.decide(state, coach, rng());

    assertThat(action).isNotEqualTo(java.util.Optional.of(EndOfHalfDecider.Action.KNEEL));
  }

  @Test
  void decide_trailingWithNoTimeoutsLateQ2ClockRunning_returnsSpike() {
    var state = TestGameStates.of(2, 5, 50, 2, 25, 0, 7, Side.HOME);
    state = exhaustTimeouts(state, Side.HOME);

    var action = decider.decide(state, coach, rng());

    assertThat(action).contains(EndOfHalfDecider.Action.SPIKE);
  }

  @Test
  void decide_trailingWithTimeoutsRemaining_doesNotSpike() {
    var state = TestGameStates.of(2, 5, 50, 2, 25, 0, 7, Side.HOME);

    var action = decider.decide(state, coach, rng());

    assertThat(action).isEmpty();
  }

  @Test
  void decide_trailingOnFourthDownLateNoTimeouts_doesNotSpike() {
    var state = TestGameStates.of(4, 5, 50, 4, 25, 0, 7, Side.HOME);
    state = exhaustTimeouts(state, Side.HOME);

    var action = decider.decide(state, coach, rng());

    assertThat(action).isEmpty();
  }

  @Test
  void decide_earlyInGame_doesNotKneelOrSpike() {
    var state = TestGameStates.of(1, 10, 25, 1, 600, 0, 0, Side.HOME);

    assertThat(decider.decide(state, coach, rng())).isEmpty();
  }
}
