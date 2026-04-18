package app.zoneblitz.gamesimulator;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.event.DownAndDistance;
import app.zoneblitz.gamesimulator.event.FieldPosition;
import app.zoneblitz.gamesimulator.event.FumbleOutcome;
import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.PlayId;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.RunConcept;
import app.zoneblitz.gamesimulator.event.Score;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class GameStateTests {

  @Test
  void afterScrimmage_returnsNewInstance_originalUnchanged() {
    var original = GameState.initial();
    var newClock = new GameClock(1, 14 * 60);
    var event =
        new PlayEvent.Run(
            new PlayId(new UUID(0L, 0L)),
            new GameId(new UUID(0L, 1L)),
            0,
            original.downAndDistance(),
            original.spot(),
            original.clock(),
            newClock,
            new Score(7, 0),
            new PlayerId(new UUID(0L, 2L)),
            RunConcept.INSIDE_ZONE,
            5,
            new FieldPosition(30),
            Optional.<PlayerId>empty(),
            Optional.<FumbleOutcome>empty(),
            false,
            true,
            0L);

    var next =
        original.afterScrimmage(event, newClock, new FieldPosition(30), new DownAndDistance(1, 10));

    assertThat(next).isNotSameAs(original);
    assertThat(next.score()).isEqualTo(new Score(7, 0));
    assertThat(next.clock()).isEqualTo(newClock);
    assertThat(next.spot()).isEqualTo(new FieldPosition(30));
    assertThat(next.downAndDistance()).isEqualTo(new DownAndDistance(1, 10));
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
