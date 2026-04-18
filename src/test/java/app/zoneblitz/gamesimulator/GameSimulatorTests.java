package app.zoneblitz.gamesimulator;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class GameSimulatorTests {

  private static final GameId GAME_ID = new GameId(new UUID(42L, 99L));
  private static final PlayerId CARRIER = new PlayerId(new UUID(1L, 1L));
  private static final PlayerId COACH = new PlayerId(new UUID(2L, 2L));
  private static final TeamId HOME = new TeamId(new UUID(3L, 3L));
  private static final TeamId AWAY = new TeamId(new UUID(4L, 4L));

  private SimulateGame newSimulator(int snaps) {
    return new GameSimulator(
        ScriptedPlayCaller.runs(snaps), new ConstantPlayResolver(GAME_ID, CARRIER), snaps);
  }

  private static GameInputs inputs(Optional<Long> seed) {
    return new GameInputs(
        GAME_ID,
        HOME,
        AWAY,
        List.of(CARRIER),
        List.of(),
        COACH,
        COACH,
        new GameInputs.PreGameContext(),
        seed);
  }

  @Test
  void simulate_withScriptedCaller_emitsOneEventPerSnap() {
    var simulator = newSimulator(10);

    var events = simulator.simulate(inputs(Optional.of(1L))).toList();

    assertThat(events).hasSize(10);
    for (var i = 0; i < events.size(); i++) {
      assertThat(events.get(i).sequence()).isEqualTo(i);
    }
  }

  @Test
  void simulate_sameSeed_producesByteIdenticalStream() {
    var a = newSimulator(25).simulate(inputs(Optional.of(12345L))).toList();
    var b = newSimulator(25).simulate(inputs(Optional.of(12345L))).toList();

    assertThat(a).isEqualTo(b);
  }

  @Test
  void simulate_differentSeed_producesDifferentStream() {
    var a = newSimulator(25).simulate(inputs(Optional.of(1L))).toList();
    var b = newSimulator(25).simulate(inputs(Optional.of(2L))).toList();

    assertThat(a).isNotEqualTo(b);
  }
}
