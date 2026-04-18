package app.zoneblitz.gamesimulator.kickoff;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.Side;
import org.junit.jupiter.api.Test;

class ScoreAndTimeOnsideKickPolicyTests {

  private final OnsideKickPolicy policy = new ScoreAndTimeOnsideKickPolicy();

  @Test
  void shouldAttemptOnside_whenLeading_returnsFalse() {
    // Kicking team is AWAY (home receiving), AWAY leads 21-14.
    assertThat(policy.shouldAttemptOnside(Side.HOME, new Score(14, 21), new GameClock(4, 120)))
        .isFalse();
  }

  @Test
  void shouldAttemptOnside_whenTied_returnsFalse() {
    assertThat(policy.shouldAttemptOnside(Side.HOME, new Score(21, 21), new GameClock(4, 60)))
        .isFalse();
  }

  @Test
  void shouldAttemptOnside_whenTrailingEarlyInGame_returnsFalse() {
    // AWAY kicking, AWAY trails 7-14 but it's Q2; too early.
    assertThat(policy.shouldAttemptOnside(Side.HOME, new Score(14, 7), new GameClock(2, 300)))
        .isFalse();
  }

  @Test
  void shouldAttemptOnside_whenTrailingEarlyQ4_returnsFalse() {
    // Q4 with 10 minutes left — outside the 5-minute window.
    assertThat(policy.shouldAttemptOnside(Side.HOME, new Score(14, 7), new GameClock(4, 600)))
        .isFalse();
  }

  @Test
  void shouldAttemptOnside_whenTrailingLateQ4_returnsTrue() {
    // AWAY trails 14-21 with 2:00 left in Q4.
    assertThat(policy.shouldAttemptOnside(Side.HOME, new Score(21, 14), new GameClock(4, 120)))
        .isTrue();
  }

  @Test
  void shouldAttemptOnside_whenDeficitTooLarge_returnsFalse() {
    // AWAY down 3 to 24 (21-point deficit); onside isn't going to save this.
    assertThat(policy.shouldAttemptOnside(Side.HOME, new Score(24, 3), new GameClock(4, 120)))
        .isFalse();
  }

  @Test
  void shouldAttemptOnside_inOvertime_returnsTrueWhenTrailing() {
    // OT (quarter >= 5) and trailing 0-3.
    assertThat(policy.shouldAttemptOnside(Side.HOME, new Score(3, 0), new GameClock(5, 300)))
        .isTrue();
  }
}
