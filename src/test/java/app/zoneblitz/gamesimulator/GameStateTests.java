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
import app.zoneblitz.gamesimulator.event.Side;
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
  void withTimeoutUsed_home_decrementsHomeTimeoutsOnly() {
    var state = GameState.initial();
    var after = state.withTimeoutUsed(Side.HOME);

    assertThat(after.homeTimeouts()).isEqualTo(2);
    assertThat(after.awayTimeouts()).isEqualTo(3);
  }

  @Test
  void withTimeoutUsed_whenNoneRemaining_throws() {
    var state =
        GameState.initial()
            .withTimeoutUsed(Side.AWAY)
            .withTimeoutUsed(Side.AWAY)
            .withTimeoutUsed(Side.AWAY);

    org.assertj.core.api.Assertions.assertThatThrownBy(() -> state.withTimeoutUsed(Side.AWAY))
        .isInstanceOf(IllegalStateException.class);
  }

  @Test
  void withTimeoutsReset_restoresBothSidesToThree() {
    var state = GameState.initial().withTimeoutUsed(Side.HOME).withTimeoutUsed(Side.AWAY);

    var reset = state.withTimeoutsReset();

    assertThat(reset.homeTimeouts()).isEqualTo(3);
    assertThat(reset.awayTimeouts()).isEqualTo(3);
  }

  @Test
  void timeoutsFor_returnsSideSpecificCount() {
    var state = GameState.initial().withTimeoutUsed(Side.HOME);

    assertThat(state.timeoutsFor(Side.HOME)).isEqualTo(2);
    assertThat(state.timeoutsFor(Side.AWAY)).isEqualTo(3);
  }

  @Test
  void withSnapsAccumulated_incrementsEveryParticipant() {
    var p1 = new PlayerId(new UUID(7L, 1L));
    var p2 = new PlayerId(new UUID(7L, 2L));
    var state =
        GameState.initial().withSnapsAccumulated(List.of(p1, p2)).withSnapsAccumulated(List.of(p1));

    assertThat(state.fatigueSnapCounts()).containsEntry(p1, 2).containsEntry(p2, 1);
  }

  @Test
  void withFatigueRecovered_full_zeroesAllCounts() {
    var p1 = new PlayerId(new UUID(7L, 1L));
    var state =
        GameState.initial().withSnapsAccumulated(List.of(p1, p1, p1)).withFatigueRecovered(1.0);

    assertThat(state.fatigueSnapCounts()).isEmpty();
  }

  @Test
  void withFatigueRecovered_partial_scalesCountsDown() {
    var p1 = new PlayerId(new UUID(7L, 1L));
    var seeded = GameState.initial();
    for (var i = 0; i < 10; i++) {
      seeded = seeded.withSnapsAccumulated(List.of(p1));
    }
    var recovered = seeded.withFatigueRecovered(0.5);

    assertThat(recovered.fatigueSnapCounts()).containsEntry(p1, 5);
  }

  @Test
  void withPossessionAndSpot_appliesPartialFatigueRecovery() {
    var p1 = new PlayerId(new UUID(7L, 1L));
    var seeded = GameState.initial();
    for (var i = 0; i < 100; i++) {
      seeded = seeded.withSnapsAccumulated(List.of(p1));
    }
    var afterPossessionFlip = seeded.withPossessionAndSpot(Side.AWAY, new FieldPosition(25));

    assertThat(afterPossessionFlip.fatigueSnapCounts().get(p1)).isLessThan(100);
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
