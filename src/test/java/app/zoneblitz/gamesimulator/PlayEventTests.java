package app.zoneblitz.gamesimulator;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class PlayEventTests {

  private static final PlayId PLAY = new PlayId(new UUID(0L, 0L));
  private static final GameId GAME = new GameId(new UUID(0L, 1L));
  private static final DownAndDistance DD = new DownAndDistance(1, 10);
  private static final FieldPosition SPOT = new FieldPosition(25);
  private static final GameClock CLOCK = new GameClock(1, 900);
  private static final Score SCORE = new Score(0, 0);
  private static final PlayerId PLAYER = new PlayerId(new UUID(9L, 9L));

  @Test
  void sealedUnion_exhaustiveSwitch_compiles() {
    var events =
        List.<PlayEvent>of(
            new PlayEvent.PassComplete(
                PLAY,
                GAME,
                0,
                DD,
                SPOT,
                CLOCK,
                CLOCK,
                SCORE,
                PLAYER,
                PLAYER,
                0,
                0,
                0,
                SPOT,
                Optional.<PlayerId>empty(),
                List.<PlayerId>of(),
                false,
                false),
            new PlayEvent.PassIncomplete(
                PLAY,
                GAME,
                1,
                DD,
                SPOT,
                CLOCK,
                CLOCK,
                SCORE,
                PLAYER,
                PLAYER,
                0,
                IncompleteReason.DROPPED,
                Optional.<PlayerId>empty()),
            new PlayEvent.Sack(
                PLAY,
                GAME,
                2,
                DD,
                SPOT,
                CLOCK,
                CLOCK,
                SCORE,
                PLAYER,
                List.<PlayerId>of(),
                0,
                Optional.<FumbleOutcome>empty()),
            new PlayEvent.Scramble(
                PLAY,
                GAME,
                3,
                DD,
                SPOT,
                CLOCK,
                CLOCK,
                SCORE,
                PLAYER,
                0,
                SPOT,
                Optional.<PlayerId>empty(),
                false,
                false),
            new PlayEvent.Interception(
                PLAY, GAME, 4, DD, SPOT, CLOCK, CLOCK, SCORE, PLAYER, PLAYER, PLAYER, 0, SPOT,
                false),
            new PlayEvent.Run(
                PLAY,
                GAME,
                5,
                DD,
                SPOT,
                CLOCK,
                CLOCK,
                SCORE,
                PLAYER,
                RunConcept.INSIDE_ZONE,
                0,
                SPOT,
                Optional.<PlayerId>empty(),
                Optional.<FumbleOutcome>empty(),
                false,
                false,
                0L),
            new PlayEvent.FieldGoalAttempt(
                PLAY,
                GAME,
                6,
                DD,
                SPOT,
                CLOCK,
                CLOCK,
                SCORE,
                PLAYER,
                40,
                FieldGoalResult.GOOD,
                Optional.<PlayerId>empty()),
            new PlayEvent.ExtraPoint(
                PLAY, GAME, 7, DD, SPOT, CLOCK, CLOCK, SCORE, PLAYER, PatResult.GOOD),
            new PlayEvent.TwoPointAttempt(
                PLAY, GAME, 8, DD, SPOT, CLOCK, CLOCK, SCORE, TwoPointPlay.RUN, false),
            new PlayEvent.Punt(
                PLAY,
                GAME,
                9,
                DD,
                SPOT,
                CLOCK,
                CLOCK,
                SCORE,
                PLAYER,
                45,
                Optional.<PlayerId>empty(),
                0,
                PuntResult.TOUCHBACK),
            new PlayEvent.Kickoff(
                PLAY,
                GAME,
                10,
                DD,
                SPOT,
                CLOCK,
                CLOCK,
                SCORE,
                PLAYER,
                KickoffResult.TOUCHBACK,
                Optional.<PlayerId>empty(),
                0,
                false),
            new PlayEvent.Penalty(
                PLAY,
                GAME,
                11,
                DD,
                SPOT,
                CLOCK,
                CLOCK,
                SCORE,
                PenaltyType.FALSE_START,
                Team.HOME,
                PLAYER,
                5,
                true,
                Optional.<PlayEvent>empty()),
            new PlayEvent.Kneel(PLAY, GAME, 12, DD, SPOT, CLOCK, CLOCK, SCORE),
            new PlayEvent.Spike(PLAY, GAME, 13, DD, SPOT, CLOCK, CLOCK, SCORE),
            new PlayEvent.Timeout(PLAY, GAME, 14, DD, SPOT, CLOCK, CLOCK, SCORE, Team.HOME),
            new PlayEvent.TwoMinuteWarning(PLAY, GAME, 15, DD, SPOT, CLOCK, CLOCK, SCORE),
            new PlayEvent.EndOfQuarter(PLAY, GAME, 16, DD, SPOT, CLOCK, CLOCK, SCORE, 1));

    for (var event : events) {
      var label =
          switch (event) {
            case PlayEvent.PassComplete pc -> "pass-complete";
            case PlayEvent.PassIncomplete pi -> "pass-incomplete";
            case PlayEvent.Sack s -> "sack";
            case PlayEvent.Scramble s -> "scramble";
            case PlayEvent.Interception i -> "interception";
            case PlayEvent.Run r -> "run";
            case PlayEvent.FieldGoalAttempt fg -> "field-goal";
            case PlayEvent.ExtraPoint xp -> "extra-point";
            case PlayEvent.TwoPointAttempt tp -> "two-point";
            case PlayEvent.Punt p -> "punt";
            case PlayEvent.Kickoff k -> "kickoff";
            case PlayEvent.Penalty p -> "penalty";
            case PlayEvent.Kneel k -> "kneel";
            case PlayEvent.Spike s -> "spike";
            case PlayEvent.Timeout t -> "timeout";
            case PlayEvent.TwoMinuteWarning w -> "two-minute";
            case PlayEvent.EndOfQuarter e -> "end-of-quarter";
          };
      assertThat(label).isNotBlank();
    }
    assertThat(events).hasSize(17);
  }
}
