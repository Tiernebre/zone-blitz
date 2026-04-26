package app.zoneblitz.gamesimulator.adjustments;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.event.DownAndDistance;
import app.zoneblitz.gamesimulator.event.FieldPosition;
import app.zoneblitz.gamesimulator.event.FumbleOutcome;
import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.IncompleteReason;
import app.zoneblitz.gamesimulator.event.PassConcept;
import app.zoneblitz.gamesimulator.event.PenaltyType;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.PlayId;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.RunConcept;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.formation.OffensiveFormation;
import app.zoneblitz.gamesimulator.playcalling.PlayCaller.PlayCall;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class RollingGameStatsAccumulatorTests {

  private GameStatsAccumulator accumulator;
  private GameStats prior;

  @BeforeEach
  void setUp() {
    accumulator = new RollingGameStatsAccumulator();
    prior = GameStats.empty();
  }

  @Test
  void apply_passComplete_incrementsAttemptsCompletionsAndYards() {
    var event = passComplete(8);

    var next = accumulator.apply(prior, event, Side.HOME, dropbackCall());

    assertThat(next.home().passAttempts()).isEqualTo(1);
    assertThat(next.home().completions()).isEqualTo(1);
    assertThat(next.home().passYards()).isEqualTo(8);
    assertThat(next.away()).isEqualTo(TeamPlayLog.empty());
  }

  @Test
  void apply_passComplete_explosiveThresholdTriggersExplosivePlayCounter() {
    var event = passComplete(20);

    var next = accumulator.apply(prior, event, Side.HOME, dropbackCall());

    assertThat(next.home().explosivePlays()).isEqualTo(1);
  }

  @Test
  void apply_passComplete_belowExplosiveThreshold_doesNotIncrementExplosive() {
    var event = passComplete(14);

    var next = accumulator.apply(prior, event, Side.HOME, dropbackCall());

    assertThat(next.home().explosivePlays()).isZero();
  }

  @Test
  void apply_passIncomplete_incrementsAttemptsButNotCompletions() {
    var event = passIncomplete();

    var next = accumulator.apply(prior, event, Side.AWAY, dropbackCall());

    assertThat(next.away().passAttempts()).isEqualTo(1);
    assertThat(next.away().completions()).isZero();
    assertThat(next.away().passYards()).isZero();
  }

  @Test
  void apply_interception_incrementsAttemptsAndInterceptions() {
    var event = interception();

    var next = accumulator.apply(prior, event, Side.HOME, dropbackCall());

    assertThat(next.home().passAttempts()).isEqualTo(1);
    assertThat(next.home().interceptions()).isEqualTo(1);
  }

  @Test
  void apply_sack_incrementsSacksNotPassAttempts() {
    var event = sack();

    var next = accumulator.apply(prior, event, Side.HOME, dropbackCall());

    assertThat(next.home().sacks()).isEqualTo(1);
    assertThat(next.home().passAttempts()).isZero();
  }

  @Test
  void apply_run_incrementsRushAttemptsAndYards() {
    var event = run(6);

    var next = accumulator.apply(prior, event, Side.HOME, runCall());

    assertThat(next.home().rushAttempts()).isEqualTo(1);
    assertThat(next.home().rushYards()).isEqualTo(6);
    assertThat(next.home().stuffs()).isZero();
  }

  @Test
  void apply_run_zeroOrNegativeYards_incrementsStuffs() {
    var event = run(-1);

    var next = accumulator.apply(prior, event, Side.HOME, runCall());

    assertThat(next.home().stuffs()).isEqualTo(1);
  }

  @Test
  void apply_run_explosiveYards_incrementsExplosivePlays() {
    var event = run(18);

    var next = accumulator.apply(prior, event, Side.HOME, runCall());

    assertThat(next.home().explosivePlays()).isEqualTo(1);
  }

  @Test
  void apply_scramble_incrementsRushNotPassAttempts() {
    var event = scramble(4);

    var next = accumulator.apply(prior, event, Side.HOME, dropbackCall());

    assertThat(next.home().rushAttempts()).isEqualTo(1);
    assertThat(next.home().rushYards()).isEqualTo(4);
    assertThat(next.home().passAttempts()).isZero();
  }

  @Test
  void apply_homeOffense_doesNotTouchAwayLog() {
    var event = run(5);

    var next = accumulator.apply(prior, event, Side.HOME, runCall());

    assertThat(next.away()).isEqualTo(TeamPlayLog.empty());
  }

  @Test
  void apply_screenConcept_incrementsScreenAttempts() {
    var event = passComplete(3);

    var next =
        accumulator.apply(prior, event, Side.HOME, Optional.of(passCall(PassConcept.SCREEN)));

    assertThat(next.home().screenAttempts()).isEqualTo(1);
    assertThat(next.home().recentPlays()).containsExactly(PlayKind.PASS_SCREEN);
  }

  @Test
  void apply_playActionConcept_incrementsPlayActionAttempts() {
    var event = passComplete(12);

    var next =
        accumulator.apply(prior, event, Side.HOME, Optional.of(passCall(PassConcept.PLAY_ACTION)));

    assertThat(next.home().playActionAttempts()).isEqualTo(1);
    assertThat(next.home().recentPlays()).containsExactly(PlayKind.PASS_PLAY_ACTION);
  }

  @Test
  void apply_nonScrimmageEvent_returnsPriorUnchanged() {
    var penalty = penalty();

    var next = accumulator.apply(prior, penalty, Side.HOME, Optional.empty());

    assertThat(next).isSameAs(prior);
  }

  @Test
  void apply_recentPlaysWindow_evictsAtCapacity() {
    var stats = prior;
    for (var i = 0; i < TeamPlayLog.RECENT_WINDOW + 2; i++) {
      stats = accumulator.apply(stats, run(3), Side.HOME, runCall());
    }

    assertThat(stats.home().recentPlays()).hasSize(TeamPlayLog.RECENT_WINDOW);
    assertThat(stats.home().rushAttempts()).isEqualTo(TeamPlayLog.RECENT_WINDOW + 2);
  }

  // ----- helpers -----

  private static PlayEvent.PassComplete passComplete(int yards) {
    return new PlayEvent.PassComplete(
        playId(),
        gameId(),
        0,
        new DownAndDistance(1, 10),
        new FieldPosition(50),
        new GameClock(1, 900),
        new GameClock(1, 870),
        new Score(0, 0),
        playerId(1),
        playerId(2),
        yards,
        0,
        yards,
        new FieldPosition(50 + yards),
        Optional.<PlayerId>empty(),
        List.<PlayerId>of(),
        false,
        false);
  }

  private static PlayEvent.PassIncomplete passIncomplete() {
    return new PlayEvent.PassIncomplete(
        playId(),
        gameId(),
        0,
        new DownAndDistance(1, 10),
        new FieldPosition(50),
        new GameClock(1, 900),
        new GameClock(1, 870),
        new Score(0, 0),
        playerId(1),
        playerId(2),
        8,
        IncompleteReason.OVERTHROWN,
        Optional.<PlayerId>empty());
  }

  private static PlayEvent.Interception interception() {
    return new PlayEvent.Interception(
        playId(),
        gameId(),
        0,
        new DownAndDistance(1, 10),
        new FieldPosition(50),
        new GameClock(1, 900),
        new GameClock(1, 870),
        new Score(0, 0),
        playerId(1),
        playerId(2),
        playerId(3),
        0,
        new FieldPosition(45),
        false);
  }

  private static PlayEvent.Sack sack() {
    return new PlayEvent.Sack(
        playId(),
        gameId(),
        0,
        new DownAndDistance(1, 10),
        new FieldPosition(50),
        new GameClock(1, 900),
        new GameClock(1, 870),
        new Score(0, 0),
        playerId(1),
        List.of(playerId(4)),
        7,
        Optional.<FumbleOutcome>empty());
  }

  private static PlayEvent.Run run(int yards) {
    return new PlayEvent.Run(
        playId(),
        gameId(),
        0,
        new DownAndDistance(1, 10),
        new FieldPosition(50),
        new GameClock(1, 900),
        new GameClock(1, 870),
        new Score(0, 0),
        playerId(5),
        RunConcept.INSIDE_ZONE,
        yards,
        new FieldPosition(50 + yards),
        Optional.<PlayerId>empty(),
        Optional.<FumbleOutcome>empty(),
        false,
        false,
        0L);
  }

  private static PlayEvent.Scramble scramble(int yards) {
    return new PlayEvent.Scramble(
        playId(),
        gameId(),
        0,
        new DownAndDistance(1, 10),
        new FieldPosition(50),
        new GameClock(1, 900),
        new GameClock(1, 870),
        new Score(0, 0),
        playerId(1),
        yards,
        new FieldPosition(50 + yards),
        Optional.<PlayerId>empty(),
        false,
        false);
  }

  private static PlayEvent.Penalty penalty() {
    return new PlayEvent.Penalty(
        playId(),
        gameId(),
        0,
        new DownAndDistance(1, 10),
        new FieldPosition(50),
        new GameClock(1, 900),
        new GameClock(1, 870),
        new Score(0, 0),
        PenaltyType.HOLDING_OFFENSE,
        Side.HOME,
        playerId(7),
        10,
        true,
        Optional.<PlayEvent>empty());
  }

  private static Optional<PlayCall> dropbackCall() {
    return Optional.of(passCall(PassConcept.DROPBACK));
  }

  private static Optional<PlayCall> runCall() {
    return Optional.of(
        new PlayCall(
            "run", RunConcept.INSIDE_ZONE, PassConcept.DROPBACK, OffensiveFormation.SINGLEBACK));
  }

  private static PlayCall passCall(PassConcept concept) {
    return new PlayCall("pass", RunConcept.INSIDE_ZONE, concept, OffensiveFormation.SHOTGUN);
  }

  private static PlayId playId() {
    return new PlayId(new UUID(0L, 1L));
  }

  private static GameId gameId() {
    return new GameId(new UUID(0L, 2L));
  }

  private static PlayerId playerId(long id) {
    return new PlayerId(new UUID(0L, id));
  }
}
