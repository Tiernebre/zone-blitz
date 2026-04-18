package app.zoneblitz.gamesimulator.output;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.event.DownAndDistance;
import app.zoneblitz.gamesimulator.event.FieldPosition;
import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.PlayId;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.RunConcept;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.TeamId;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class StatsProjectionTests {

  private static final GameId GAME = new GameId(new UUID(0, 7));
  private static final TeamId HOME = new TeamId(new UUID(1, 1));
  private static final TeamId AWAY = new TeamId(new UUID(2, 2));
  private static final PlayerId RB = new PlayerId(new UUID(9, 1));

  private final StatsAssembler assembler = new BoxScoreAssembler();
  private final TeamAssignment assignment = new TeamAssignment(HOME, AWAY, Map.of(RB, HOME));

  @Test
  void incrementalMode_equalsTerminalMode_overSameStream() {
    var events = List.<PlayEvent>of(run(0, 4), run(1, 7), run(2, 2));

    var terminal = assembler.finalize(GAME, assignment, events.stream());
    var incremental = assembler.incremental(GAME, assignment);
    for (var e : events) {
      incremental = incremental.apply(e);
    }
    var snapshot = incremental.snapshot();

    assertThat(snapshot.players().get(RB).rushYards())
        .isEqualTo(terminal.players().get(RB).rushYards());
    assertThat(snapshot.home().rushingYards()).isEqualTo(terminal.home().rushingYards());
  }

  @Test
  void apply_returnsNewInstance_doesNotMutatePrior() {
    var p0 = assembler.incremental(GAME, assignment);
    var p1 = p0.apply(run(0, 5));
    var p2 = p1.apply(run(1, 3));

    assertThat(p0).isNotSameAs(p1);
    assertThat(p1).isNotSameAs(p2);
    assertThat(p0.snapshot().players()).isEmpty();
    assertThat(p1.snapshot().players().get(RB).rushYards()).isEqualTo(5);
    assertThat(p2.snapshot().players().get(RB).rushYards()).isEqualTo(8);
  }

  private static PlayEvent.Run run(int seq, int yards) {
    return new PlayEvent.Run(
        PlayId.random(),
        GAME,
        seq,
        new DownAndDistance(1, 10),
        new FieldPosition(25),
        new GameClock(1, 900),
        new GameClock(1, 890),
        new Score(0, 0),
        RB,
        RunConcept.INSIDE_ZONE,
        yards,
        new FieldPosition(25 + yards),
        Optional.empty(),
        Optional.empty(),
        false,
        false,
        0L);
  }
}
