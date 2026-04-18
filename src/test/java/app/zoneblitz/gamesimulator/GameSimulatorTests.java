package app.zoneblitz.gamesimulator;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.TeamId;
import app.zoneblitz.gamesimulator.personnel.FakePersonnelSelector;
import app.zoneblitz.gamesimulator.personnel.TestPersonnel;
import app.zoneblitz.gamesimulator.roster.Coach;
import app.zoneblitz.gamesimulator.roster.CoachId;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Team;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class GameSimulatorTests {

  private static final GameId GAME_ID = new GameId(new UUID(42L, 99L));
  private static final PlayerId QB_ID = new PlayerId(new UUID(1L, 1L));
  private static final PlayerId WR_ID = new PlayerId(new UUID(1L, 2L));
  private static final Player QB = new Player(QB_ID, Position.QB, "Test QB");
  private static final Player WR = new Player(WR_ID, Position.WR, "Test WR");
  private static final Coach HOME_COACH = new Coach(new CoachId(new UUID(2L, 2L)), "Home Coach");
  private static final Coach AWAY_COACH = new Coach(new CoachId(new UUID(2L, 3L)), "Away Coach");
  private static final Team HOME =
      new Team(new TeamId(new UUID(3L, 3L)), "Home Team", List.of(QB, WR));
  private static final Team AWAY = new Team(new TeamId(new UUID(4L, 4L)), "Away Team", List.of());

  private SimulateGame newSimulator(int snaps) {
    var personnel =
        new FakePersonnelSelector(TestPersonnel.baselineOffense(), TestPersonnel.baselineDefense());
    return new GameSimulator(
        ScriptedPlayCaller.runs(snaps), personnel, new ConstantPlayResolver(QB_ID, WR_ID), snaps);
  }

  private static GameInputs inputs(Optional<Long> seed) {
    return new GameInputs(
        GAME_ID, HOME, AWAY, HOME_COACH, AWAY_COACH, new GameInputs.PreGameContext(), seed);
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
