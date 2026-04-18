package app.zoneblitz.gamesimulator;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class GameStateTests {

  @Test
  void apply_returnsNewInstance_originalUnchanged() {
    var original = GameState.initial();
    var event =
        new PlayEvent.Run(
            new PlayId(new UUID(0L, 0L)),
            new GameId(new UUID(0L, 1L)),
            0,
            original.downAndDistance(),
            original.spot(),
            original.clock(),
            original.clock(),
            new Score(7, 0),
            new PlayerId(new UUID(0L, 2L)),
            RunConcept.INSIDE_ZONE,
            5,
            new FieldPosition(30),
            Optional.<PlayerId>empty(),
            Optional.<FumbleOutcome>empty(),
            false,
            false,
            0L);
    var newClock = new GameClock(1, 14 * 60);

    var next = original.apply(event, newClock);

    assertThat(next).isNotSameAs(original);
    assertThat(next.score()).isEqualTo(new Score(7, 0));
    assertThat(next.clock()).isEqualTo(newClock);
    assertThat(original.score()).isEqualTo(new Score(0, 0));
    assertThat(original.clock()).isEqualTo(new GameClock(1, 15 * 60));
  }

  @Test
  void initial_hasZeroedState() {
    var state = GameState.initial();
    assertThat(state.score()).isEqualTo(new Score(0, 0));
    assertThat(state.fatigueSnapCounts()).isEmpty();
    assertThat(state.injuredPlayers()).isEqualTo(List.<PlayerId>of());
    assertThat(state.phase()).isEqualTo(GameState.Phase.REGULATION);
    assertThat(state.overtimeRound()).isZero();
  }
}
