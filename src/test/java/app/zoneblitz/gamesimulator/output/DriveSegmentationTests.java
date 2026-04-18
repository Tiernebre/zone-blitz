package app.zoneblitz.gamesimulator.output;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.event.DownAndDistance;
import app.zoneblitz.gamesimulator.event.FieldGoalResult;
import app.zoneblitz.gamesimulator.event.FieldPosition;
import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.PlayId;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.PuntResult;
import app.zoneblitz.gamesimulator.event.RunConcept;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.TeamId;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

class DriveSegmentationTests {

  private static final GameId GAME = new GameId(new UUID(0, 5));
  private static final TeamId HOME = new TeamId(new UUID(1, 1));
  private static final TeamId AWAY = new TeamId(new UUID(2, 2));
  private static final PlayerId HOME_RB = new PlayerId(new UUID(10, 1));
  private static final PlayerId HOME_QB = new PlayerId(new UUID(10, 2));
  private static final PlayerId HOME_K = new PlayerId(new UUID(10, 3));
  private static final PlayerId HOME_P = new PlayerId(new UUID(10, 4));
  private static final PlayerId AWAY_RB = new PlayerId(new UUID(20, 1));
  private static final PlayerId AWAY_CB = new PlayerId(new UUID(20, 2));

  private final StatsAssembler assembler = new BoxScoreAssembler();
  private final TeamAssignment assignment =
      new TeamAssignment(
          HOME,
          AWAY,
          Map.of(
              HOME_RB, HOME,
              HOME_QB, HOME,
              HOME_K, HOME,
              HOME_P, HOME,
              AWAY_RB, AWAY,
              AWAY_CB, AWAY));

  @Test
  void changeOfPossession_splitsDrives() {
    var stats =
        assembler.finalize(
            GAME,
            assignment,
            Stream.of(
                run(HOME_RB, 0, 3),
                run(HOME_RB, 1, 4),
                punt(HOME_P, 2, 48),
                run(AWAY_RB, 3, 7),
                run(AWAY_RB, 4, 2)));

    var drives = stats.drives();
    assertThat(drives).hasSize(2);
    assertThat(drives.get(0).offense()).isEqualTo(HOME);
    assertThat(drives.get(0).result()).isEqualTo(DriveResult.PUNT);
    assertThat(drives.get(0).plays()).isEqualTo(3);
    assertThat(drives.get(1).offense()).isEqualTo(AWAY);
    assertThat(drives.get(1).result()).isEqualTo(DriveResult.END_OF_GAME);
    assertThat(drives.get(1).plays()).isEqualTo(2);
  }

  @Test
  void interception_endsDriveAsInt() {
    var stats =
        assembler.finalize(
            GAME, assignment, Stream.of(run(HOME_RB, 0, 3), interception(HOME_QB, AWAY_CB, 1)));

    assertThat(stats.drives()).hasSize(1);
    assertThat(stats.drives().getFirst().result()).isEqualTo(DriveResult.INT);
    assertThat(stats.drives().getFirst().plays()).isEqualTo(2);
  }

  @Test
  void fieldGoalMissed_endsDriveAsMissedFg() {
    var stats =
        assembler.finalize(
            GAME,
            assignment,
            Stream.of(run(HOME_RB, 0, 2), fieldGoal(HOME_K, 1, FieldGoalResult.MISSED)));

    assertThat(stats.drives()).hasSize(1);
    assertThat(stats.drives().getFirst().result()).isEqualTo(DriveResult.MISSED_FG);
  }

  @Test
  void driveYards_sumYardsOfPlaysInDrive() {
    var stats =
        assembler.finalize(
            GAME,
            assignment,
            Stream.of(run(HOME_RB, 0, 5), run(HOME_RB, 1, 7), punt(HOME_P, 2, 40)));

    var drive = stats.drives().getFirst();
    assertThat(drive.yards()).isEqualTo(12);
    assertThat(drive.plays()).isEqualTo(3);
  }

  @Test
  void punt_segmentDriveEvenWithoutPriorOffensivePlays() {
    var stats = assembler.finalize(GAME, assignment, Stream.of(punt(HOME_P, 0, 48)));

    assertThat(stats.drives()).hasSize(1);
    assertThat(stats.drives().getFirst().result()).isEqualTo(DriveResult.PUNT);
  }

  @Test
  void passCompletions_accumulateDriveYards() {
    var stats =
        assembler.finalize(
            GAME,
            assignment,
            Stream.of(passComplete(HOME_QB, 0, 8, 3, 11), passComplete(HOME_QB, 1, 12, 4, 16)));

    assertThat(stats.players().get(HOME_QB).passYards()).isEqualTo(11 + 16);
    assertThat(stats.drives().getFirst().yards()).isEqualTo(27);
  }

  private static PlayEvent.Run run(PlayerId carrier, int seq, int yards) {
    return new PlayEvent.Run(
        PlayId.random(),
        GAME,
        seq,
        new DownAndDistance(1, 10),
        new FieldPosition(25),
        new GameClock(1, 900),
        new GameClock(1, 890),
        new Score(0, 0),
        carrier,
        RunConcept.INSIDE_ZONE,
        yards,
        new FieldPosition(25 + yards),
        Optional.empty(),
        Optional.empty(),
        false,
        false,
        0L);
  }

  private static PlayEvent.Punt punt(PlayerId punter, int seq, int gross) {
    return new PlayEvent.Punt(
        PlayId.random(),
        GAME,
        seq,
        new DownAndDistance(4, 10),
        new FieldPosition(25),
        new GameClock(1, 900),
        new GameClock(1, 890),
        new Score(0, 0),
        punter,
        gross,
        Optional.empty(),
        0,
        PuntResult.DOWNED);
  }

  private static PlayEvent.Interception interception(PlayerId qb, PlayerId interceptor, int seq) {
    return new PlayEvent.Interception(
        PlayId.random(),
        GAME,
        seq,
        new DownAndDistance(2, 10),
        new FieldPosition(25),
        new GameClock(1, 900),
        new GameClock(1, 890),
        new Score(0, 0),
        qb,
        new PlayerId(UUID.randomUUID()),
        interceptor,
        15,
        new FieldPosition(40),
        false);
  }

  private static PlayEvent.FieldGoalAttempt fieldGoal(PlayerId kicker, int seq, FieldGoalResult r) {
    return new PlayEvent.FieldGoalAttempt(
        PlayId.random(),
        GAME,
        seq,
        new DownAndDistance(4, 5),
        new FieldPosition(75),
        new GameClock(1, 900),
        new GameClock(1, 890),
        new Score(0, 0),
        kicker,
        42,
        r,
        Optional.empty());
  }

  private static PlayEvent.PassComplete passComplete(
      PlayerId qb, int seq, int air, int yac, int total) {
    return new PlayEvent.PassComplete(
        PlayId.random(),
        GAME,
        seq,
        new DownAndDistance(1, 10),
        new FieldPosition(25),
        new GameClock(1, 900),
        new GameClock(1, 890),
        new Score(0, 0),
        qb,
        HOME_RB,
        air,
        yac,
        total,
        new FieldPosition(25 + total),
        Optional.empty(),
        List.of(),
        false,
        true);
  }
}
