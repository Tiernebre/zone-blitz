package app.zoneblitz.gamesimulator.adjustments;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class TeamPlayLogTests {

  @Test
  void empty_returnsZeroedLog() {
    var log = TeamPlayLog.empty();

    assertThat(log.passAttempts()).isZero();
    assertThat(log.passYards()).isZero();
    assertThat(log.completions()).isZero();
    assertThat(log.sacks()).isZero();
    assertThat(log.interceptions()).isZero();
    assertThat(log.rushAttempts()).isZero();
    assertThat(log.rushYards()).isZero();
    assertThat(log.stuffs()).isZero();
    assertThat(log.explosivePlays()).isZero();
    assertThat(log.playActionAttempts()).isZero();
    assertThat(log.screenAttempts()).isZero();
    assertThat(log.recentPlays()).isEmpty();
  }

  @Test
  void yardsPerAttempt_emptyLog_returnsZero() {
    assertThat(TeamPlayLog.empty().yardsPerAttempt()).isZero();
  }

  @Test
  void yardsPerAttempt_dividesPassYardsByAttempts() {
    var log = new TeamPlayLog(10, 80, 6, 0, 0, 0, 0, 0, 0, 0, 0, List.of());

    assertThat(log.yardsPerAttempt()).isEqualTo(8.0);
  }

  @Test
  void yardsPerCarry_emptyLog_returnsZero() {
    assertThat(TeamPlayLog.empty().yardsPerCarry()).isZero();
  }

  @Test
  void yardsPerCarry_dividesRushYardsByAttempts() {
    var log = new TeamPlayLog(0, 0, 0, 0, 0, 12, 60, 2, 1, 0, 0, List.of());

    assertThat(log.yardsPerCarry()).isEqualTo(5.0);
  }

  @Test
  void completionRate_emptyLog_returnsZero() {
    assertThat(TeamPlayLog.empty().completionRate()).isZero();
  }

  @Test
  void completionRate_dividesCompletionsByAttempts() {
    var log = new TeamPlayLog(10, 80, 6, 0, 0, 0, 0, 0, 0, 0, 0, List.of());

    assertThat(log.completionRate()).isEqualTo(0.6);
  }

  @Test
  void totalScrimmagePlays_sumsPassAndRushIncludingSacks() {
    var log = new TeamPlayLog(10, 60, 5, 2, 1, 8, 30, 0, 0, 0, 0, List.of());

    assertThat(log.totalScrimmagePlays()).isEqualTo(20);
  }

  @Test
  void recentScreenShare_emptyWindow_returnsZero() {
    assertThat(TeamPlayLog.empty().recentScreenShare()).isZero();
  }

  @Test
  void recentScreenShare_dividesScreenCountByWindowSize() {
    var log = TeamPlayLog.empty();
    log = log.withRecentPlay(PlayKind.PASS_SCREEN);
    log = log.withRecentPlay(PlayKind.PASS_SCREEN);
    log = log.withRecentPlay(PlayKind.RUN);
    log = log.withRecentPlay(PlayKind.PASS_DROPBACK);

    assertThat(log.recentScreenShare()).isEqualTo(0.5);
  }

  @Test
  void withRecentPlay_underWindow_appendsAndPreservesOrder() {
    var log =
        TeamPlayLog.empty().withRecentPlay(PlayKind.RUN).withRecentPlay(PlayKind.PASS_DROPBACK);

    assertThat(log.recentPlays()).containsExactly(PlayKind.RUN, PlayKind.PASS_DROPBACK);
  }

  @Test
  void withRecentPlay_atCapacity_evictsOldestEntry() {
    var log = TeamPlayLog.empty();
    for (var i = 0; i < TeamPlayLog.RECENT_WINDOW; i++) {
      log = log.withRecentPlay(PlayKind.RUN);
    }
    log = log.withRecentPlay(PlayKind.PASS_PLAY_ACTION);

    assertThat(log.recentPlays()).hasSize(TeamPlayLog.RECENT_WINDOW);
    assertThat(log.recentPlays().get(TeamPlayLog.RECENT_WINDOW - 1))
        .isEqualTo(PlayKind.PASS_PLAY_ACTION);
    assertThat(log.recentPlays().get(0)).isEqualTo(PlayKind.RUN);
  }

  @Test
  void decay_factorOne_returnsSameLogReference() {
    var log = new TeamPlayLog(10, 80, 6, 0, 0, 0, 0, 0, 0, 0, 0, List.of());

    var decayed = log.decay(1.0);

    assertThat(decayed).isSameAs(log);
  }

  @Test
  void decay_factorBelowOne_scalesAllCounters() {
    var log = new TeamPlayLog(10, 80, 6, 2, 1, 8, 40, 1, 1, 2, 1, List.of(PlayKind.RUN));

    var decayed = log.decay(0.5);

    assertThat(decayed.passAttempts()).isEqualTo(5);
    assertThat(decayed.passYards()).isEqualTo(40);
    assertThat(decayed.completions()).isEqualTo(3);
    assertThat(decayed.sacks()).isEqualTo(1);
    assertThat(decayed.rushAttempts()).isEqualTo(4);
    assertThat(decayed.rushYards()).isEqualTo(20);
  }

  @Test
  void decay_preservesRecentPlayWindow() {
    var log =
        TeamPlayLog.empty().withRecentPlay(PlayKind.RUN).withRecentPlay(PlayKind.PASS_PLAY_ACTION);

    var decayed = log.decay(0.5);

    assertThat(decayed.recentPlays()).containsExactly(PlayKind.RUN, PlayKind.PASS_PLAY_ACTION);
  }

  @Test
  void decay_factorZero_zeroesAllCounters() {
    var log = new TeamPlayLog(10, 80, 6, 0, 0, 0, 0, 0, 0, 0, 0, List.of());

    var decayed = log.decay(0.0);

    assertThat(decayed.passAttempts()).isZero();
    assertThat(decayed.passYards()).isZero();
  }
}
