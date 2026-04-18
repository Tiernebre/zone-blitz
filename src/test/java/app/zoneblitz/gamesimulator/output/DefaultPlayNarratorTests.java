package app.zoneblitz.gamesimulator.output;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.zoneblitz.gamesimulator.event.DownAndDistance;
import app.zoneblitz.gamesimulator.event.FieldGoalResult;
import app.zoneblitz.gamesimulator.event.FieldPosition;
import app.zoneblitz.gamesimulator.event.FumbleOutcome;
import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.IncompleteReason;
import app.zoneblitz.gamesimulator.event.KickoffResult;
import app.zoneblitz.gamesimulator.event.PatResult;
import app.zoneblitz.gamesimulator.event.PenaltyType;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.PlayId;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.PuntResult;
import app.zoneblitz.gamesimulator.event.RunConcept;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.event.TwoPointPlay;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class DefaultPlayNarratorTests {

  private static final PlayId PLAY = new PlayId(new UUID(0L, 0L));
  private static final GameId GAME = new GameId(new UUID(0L, 1L));
  private static final DownAndDistance FIRST_AND_TEN = new DownAndDistance(1, 10);
  private static final DownAndDistance THIRD_AND_FOUR = new DownAndDistance(3, 4);
  private static final DownAndDistance FOURTH_AND_GOAL = new DownAndDistance(4, 0);
  private static final FieldPosition OWN_25 = new FieldPosition(25);
  private static final FieldPosition OPP_20 = new FieldPosition(80);
  private static final FieldPosition FIFTY = new FieldPosition(50);
  private static final FieldPosition GOAL_LINE = new FieldPosition(99);
  private static final GameClock Q1_OPEN = new GameClock(1, 900);
  private static final GameClock Q4_CLOSE = new GameClock(4, 57);
  private static final GameClock OT1 = new GameClock(5, 600);
  private static final Score SCORE = new Score(0, 0);

  private static final PlayerId MAHOMES = new PlayerId(new UUID(1, 1));
  private static final PlayerId KELCE = new PlayerId(new UUID(1, 2));
  private static final PlayerId PACHECO = new PlayerId(new UUID(1, 3));
  private static final PlayerId BUTKER = new PlayerId(new UUID(1, 4));
  private static final PlayerId JONES = new PlayerId(new UUID(2, 1));
  private static final PlayerId UNKNOWN = new PlayerId(new UUID(9, 9));

  private final PlayNarrator narrator = PlayNarrator.defaultNarrator();

  private final NarrationContext context =
      new NarrationContext(
          id ->
              Optional.ofNullable(
                  Map.of(
                          MAHOMES, "Mahomes",
                          KELCE, "Kelce",
                          PACHECO, "Pacheco",
                          BUTKER, "Butker",
                          JONES, "Jones")
                      .get(id)),
          side -> side == Side.HOME ? "Chiefs" : "Raiders");

  @Test
  void narrate_nullEvent_throws() {
    assertThatThrownBy(() -> narrator.narrate(null, context))
        .isInstanceOf(NullPointerException.class);
  }

  @Test
  void narrate_nullContext_throws() {
    var kneel = new PlayEvent.Kneel(PLAY, GAME, 0, FIRST_AND_TEN, OWN_25, Q1_OPEN, Q1_OPEN, SCORE);
    assertThatThrownBy(() -> narrator.narrate(kneel, null))
        .isInstanceOf(NullPointerException.class);
  }

  @Test
  void narrate_passComplete_firstDown_mentionsPlayersAndYards() {
    var event =
        new PlayEvent.PassComplete(
            PLAY,
            GAME,
            0,
            THIRD_AND_FOUR,
            OWN_25,
            Q1_OPEN,
            Q1_OPEN,
            SCORE,
            MAHOMES,
            KELCE,
            8,
            6,
            14,
            new FieldPosition(39),
            Optional.empty(),
            List.of(),
            false,
            true);

    assertThat(narrator.narrate(event, context))
        .contains("Mahomes")
        .contains("Kelce")
        .contains("14")
        .contains("1ST DOWN")
        .contains("3rd-4")
        .contains("own 25")
        .contains("own 39");
  }

  @Test
  void narrate_passComplete_touchdown_mentionsTouchdown() {
    var event =
        new PlayEvent.PassComplete(
            PLAY,
            GAME,
            0,
            FIRST_AND_TEN,
            OPP_20,
            Q1_OPEN,
            Q1_OPEN,
            SCORE,
            MAHOMES,
            KELCE,
            20,
            0,
            20,
            new FieldPosition(100),
            Optional.empty(),
            List.of(),
            true,
            true);

    assertThat(narrator.narrate(event, context)).contains("TOUCHDOWN").contains("opp 20");
  }

  @Test
  void narrate_passIncomplete_describesReason() {
    var event =
        new PlayEvent.PassIncomplete(
            PLAY,
            GAME,
            0,
            FIRST_AND_TEN,
            OWN_25,
            Q1_OPEN,
            Q1_OPEN,
            SCORE,
            MAHOMES,
            KELCE,
            15,
            IncompleteReason.DROPPED,
            Optional.empty());

    assertThat(narrator.narrate(event, context))
        .contains("Mahomes")
        .contains("incomplete")
        .contains("dropped");
  }

  @Test
  void narrate_sack_reportsLoss() {
    var event =
        new PlayEvent.Sack(
            PLAY,
            GAME,
            0,
            THIRD_AND_FOUR,
            OWN_25,
            Q1_OPEN,
            Q1_OPEN,
            SCORE,
            MAHOMES,
            List.of(JONES),
            7,
            Optional.empty());

    assertThat(narrator.narrate(event, context))
        .contains("sacked")
        .contains("Mahomes")
        .contains("Jones")
        .contains("-7");
  }

  @Test
  void narrate_sack_withFumble_reportsFumble() {
    var fumble = new FumbleOutcome(MAHOMES, true, Optional.of(JONES), 12);
    var event =
        new PlayEvent.Sack(
            PLAY,
            GAME,
            0,
            THIRD_AND_FOUR,
            OWN_25,
            Q1_OPEN,
            Q1_OPEN,
            SCORE,
            MAHOMES,
            List.of(JONES),
            5,
            Optional.of(fumble));

    assertThat(narrator.narrate(event, context)).contains("FUMBLE").contains("Jones");
  }

  @Test
  void narrate_scramble_slideOrOob_noted() {
    var event =
        new PlayEvent.Scramble(
            PLAY,
            GAME,
            0,
            THIRD_AND_FOUR,
            OWN_25,
            Q1_OPEN,
            Q1_OPEN,
            SCORE,
            MAHOMES,
            9,
            new FieldPosition(34),
            Optional.empty(),
            true,
            false);

    assertThat(narrator.narrate(event, context))
        .contains("scrambles")
        .contains("9")
        .contains("Slides");
  }

  @Test
  void narrate_interception_pickSix() {
    var event =
        new PlayEvent.Interception(
            PLAY,
            GAME,
            0,
            FIRST_AND_TEN,
            OPP_20,
            Q1_OPEN,
            Q1_OPEN,
            SCORE,
            MAHOMES,
            KELCE,
            JONES,
            80,
            new FieldPosition(0),
            true);

    assertThat(narrator.narrate(event, context))
        .contains("intercepted")
        .contains("Jones")
        .contains("PICK SIX");
  }

  @Test
  void narrate_run_withConcept() {
    var event =
        new PlayEvent.Run(
            PLAY,
            GAME,
            0,
            FIRST_AND_TEN,
            OWN_25,
            Q1_OPEN,
            Q1_OPEN,
            SCORE,
            PACHECO,
            RunConcept.INSIDE_ZONE,
            5,
            new FieldPosition(30),
            Optional.empty(),
            Optional.empty(),
            false,
            false,
            0L);

    assertThat(narrator.narrate(event, context))
        .contains("Pacheco")
        .contains("inside zone")
        .contains("5");
  }

  @Test
  void narrate_fieldGoal_good() {
    var event =
        new PlayEvent.FieldGoalAttempt(
            PLAY,
            GAME,
            0,
            FOURTH_AND_GOAL,
            GOAL_LINE,
            Q4_CLOSE,
            Q4_CLOSE,
            SCORE,
            BUTKER,
            20,
            FieldGoalResult.GOOD,
            Optional.empty());

    assertThat(narrator.narrate(event, context))
        .contains("Butker")
        .contains("20")
        .contains("GOOD")
        .contains("4th-goal");
  }

  @Test
  void narrate_fieldGoal_blocked_namesBlocker() {
    var event =
        new PlayEvent.FieldGoalAttempt(
            PLAY,
            GAME,
            0,
            new DownAndDistance(4, 5),
            FIFTY,
            Q1_OPEN,
            Q1_OPEN,
            SCORE,
            BUTKER,
            50,
            FieldGoalResult.BLOCKED,
            Optional.of(JONES));

    assertThat(narrator.narrate(event, context)).contains("BLOCKED").contains("Jones");
  }

  @Test
  void narrate_extraPoint_missed() {
    var event =
        new PlayEvent.ExtraPoint(
            PLAY,
            GAME,
            0,
            new DownAndDistance(0, 0),
            new FieldPosition(85),
            Q1_OPEN,
            Q1_OPEN,
            SCORE,
            BUTKER,
            PatResult.MISSED);

    assertThat(narrator.narrate(event, context)).contains("extra point").contains("MISSED");
  }

  @Test
  void narrate_twoPointAttempt_good() {
    var event =
        new PlayEvent.TwoPointAttempt(
            PLAY, GAME, 0, FIRST_AND_TEN, OPP_20, Q1_OPEN, Q1_OPEN, SCORE, TwoPointPlay.PASS, true);

    assertThat(narrator.narrate(event, context))
        .contains("Two-point")
        .contains("pass")
        .contains("GOOD");
  }

  @Test
  void narrate_punt_returned() {
    var event =
        new PlayEvent.Punt(
            PLAY,
            GAME,
            0,
            new DownAndDistance(4, 8),
            OWN_25,
            Q1_OPEN,
            Q1_OPEN,
            SCORE,
            BUTKER,
            45,
            Optional.of(JONES),
            12,
            PuntResult.RETURNED);

    assertThat(narrator.narrate(event, context))
        .contains("punts")
        .contains("45")
        .contains("Jones")
        .contains("12");
  }

  @Test
  void narrate_kickoff_onside() {
    var event =
        new PlayEvent.Kickoff(
            PLAY,
            GAME,
            0,
            new DownAndDistance(0, 0),
            new FieldPosition(35),
            Q4_CLOSE,
            Q4_CLOSE,
            SCORE,
            BUTKER,
            KickoffResult.ONSIDE_RECOVERED_BY_KICKING,
            Optional.empty(),
            0,
            true);

    assertThat(narrator.narrate(event, context)).contains("Onside").contains("Butker");
  }

  @Test
  void narrate_penalty_withTeamAndPlayer() {
    var event =
        new PlayEvent.Penalty(
            PLAY,
            GAME,
            0,
            FIRST_AND_TEN,
            OWN_25,
            Q1_OPEN,
            Q1_OPEN,
            SCORE,
            PenaltyType.HOLDING_OFFENSE,
            Side.HOME,
            MAHOMES,
            10,
            true,
            Optional.empty());

    assertThat(narrator.narrate(event, context))
        .contains("FLAG")
        .contains("holding offense")
        .contains("Chiefs")
        .contains("Mahomes")
        .contains("10")
        .contains("replay down");
  }

  @Test
  void narrate_kneel_mentionsKneel() {
    var event =
        new PlayEvent.Kneel(PLAY, GAME, 0, FIRST_AND_TEN, OWN_25, Q4_CLOSE, Q4_CLOSE, SCORE);

    assertThat(narrator.narrate(event, context)).contains("Kneel");
  }

  @Test
  void narrate_spike_mentionsSpike() {
    var event =
        new PlayEvent.Spike(PLAY, GAME, 0, FIRST_AND_TEN, OPP_20, Q4_CLOSE, Q4_CLOSE, SCORE);

    assertThat(narrator.narrate(event, context)).contains("Spike");
  }

  @Test
  void narrate_timeout_namesTeam() {
    var event =
        new PlayEvent.Timeout(
            PLAY, GAME, 0, FIRST_AND_TEN, OWN_25, Q1_OPEN, Q1_OPEN, SCORE, Side.AWAY);

    assertThat(narrator.narrate(event, context)).contains("Timeout").contains("Raiders");
  }

  @Test
  void narrate_twoMinuteWarning_reportsQuarter() {
    var event =
        new PlayEvent.TwoMinuteWarning(
            PLAY,
            GAME,
            0,
            FIRST_AND_TEN,
            OWN_25,
            new GameClock(2, 120),
            new GameClock(2, 120),
            SCORE);

    assertThat(narrator.narrate(event, context)).contains("Two-minute").contains("Q2");
  }

  @Test
  void narrate_endOfQuarter_halftime() {
    var event =
        new PlayEvent.EndOfQuarter(
            PLAY,
            GAME,
            0,
            FIRST_AND_TEN,
            OWN_25,
            new GameClock(2, 0),
            new GameClock(2, 0),
            SCORE,
            2);

    assertThat(narrator.narrate(event, context)).contains("End of first half");
  }

  @Test
  void narrate_endOfQuarter_regulation() {
    var event =
        new PlayEvent.EndOfQuarter(
            PLAY,
            GAME,
            0,
            FIRST_AND_TEN,
            OWN_25,
            new GameClock(4, 0),
            new GameClock(4, 0),
            SCORE,
            4);

    assertThat(narrator.narrate(event, context)).contains("End of regulation");
  }

  @Test
  void narrate_overtimeKneel_labelsOvertime() {
    var event = new PlayEvent.Kneel(PLAY, GAME, 0, FIRST_AND_TEN, OWN_25, OT1, OT1, SCORE);

    assertThat(narrator.narrate(event, context)).contains("OT");
  }

  @Test
  void narrate_unknownPlayerId_fallsBackToUnknown() {
    var event =
        new PlayEvent.PassComplete(
            PLAY,
            GAME,
            0,
            FIRST_AND_TEN,
            OWN_25,
            Q1_OPEN,
            Q1_OPEN,
            SCORE,
            UNKNOWN,
            UNKNOWN,
            5,
            0,
            5,
            new FieldPosition(30),
            Optional.empty(),
            List.of(),
            false,
            false);

    assertThat(narrator.narrate(event, context)).contains("unknown");
  }

  @Test
  void narrate_safety_includesSafetyTagConcedingTeamAndScore() {
    var event =
        new PlayEvent.Safety(
            PLAY,
            GAME,
            0,
            FIRST_AND_TEN,
            new FieldPosition(1),
            Q1_OPEN,
            Q1_OPEN,
            new Score(0, 2),
            new FieldPosition(20),
            Side.HOME);

    var line = narrator.narrate(event, context);

    assertThat(line).contains("SAFETY").contains("Chiefs").contains("own 20").contains("0 – ");
  }

  @Test
  void narrate_goalLineRun_spotShownAsOpp() {
    var event =
        new PlayEvent.Run(
            PLAY,
            GAME,
            0,
            FOURTH_AND_GOAL,
            GOAL_LINE,
            Q1_OPEN,
            Q1_OPEN,
            SCORE,
            PACHECO,
            RunConcept.QB_SNEAK,
            1,
            new FieldPosition(100),
            Optional.empty(),
            Optional.empty(),
            true,
            true,
            0L);

    assertThat(narrator.narrate(event, context))
        .contains("opp 1")
        .contains("TOUCHDOWN")
        .contains("4th-goal");
  }
}
