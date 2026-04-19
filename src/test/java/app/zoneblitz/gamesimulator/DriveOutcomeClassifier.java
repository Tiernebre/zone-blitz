package app.zoneblitz.gamesimulator;

import app.zoneblitz.gamesimulator.event.FieldGoalResult;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.PuntResult;
import app.zoneblitz.gamesimulator.event.Side;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/**
 * Reduces a game's event stream to the terminal {@link DriveOutcome} for each offensive drive.
 *
 * <p>The engine does not emit a {@code DriveEnd} event today (issue #615 is the first consumer that
 * needs one), so this classifier reconstructs drive boundaries from terminal scrimmage events:
 * scoring plays, punts, turnovers, failed 4th downs, and end-of-quarter markers on Q2 / Q4 / final
 * OT. An offensive drive is a contiguous run of snaps for one side, opened by a change of
 * possession and closed by the first terminal event.
 *
 * <p>Offensive side is derived from a caller-supplied {@code playerSide} map (player ID → Side).
 * Kickoffs, timeouts, penalties with no underlying play, and other non-scrimmage events pass
 * through without closing a drive.
 */
final class DriveOutcomeClassifier {

  private DriveOutcomeClassifier() {}

  /** Classified drive with its offensive-play count (used for 3-and-out detection). */
  record DriveResult(DriveOutcome outcome, int offensivePlays) {}

  /**
   * Classify every completed drive in the event stream. Drives still open at the end of the stream
   * (no terminal event was emitted before the game ended — typically final-half clock expiry
   * mid-drive) are closed as {@link DriveOutcome#END_OF_HALF}.
   */
  static List<DriveResult> classify(List<PlayEvent> events, Map<PlayerId, Side> playerSide) {
    Objects.requireNonNull(events, "events");
    Objects.requireNonNull(playerSide, "playerSide");
    var drives = new ArrayList<DriveResult>();
    var state = new DriveState();
    for (var event : events) {
      classifyOne(event, playerSide, state, drives);
    }
    if (state.hasOpenDrive()) {
      drives.add(new DriveResult(DriveOutcome.END_OF_HALF, state.offensivePlays()));
    }
    return List.copyOf(drives);
  }

  private static void classifyOne(
      PlayEvent event, Map<PlayerId, Side> playerSide, DriveState state, List<DriveResult> drives) {
    switch (event) {
      case PlayEvent.PassComplete c -> {
        state.open(playerSide.get(c.qb()));
        state.addOffensivePlay();
        if (c.touchdown()) {
          state.close(drives, DriveOutcome.TOUCHDOWN);
        }
      }
      case PlayEvent.PassIncomplete i -> {
        state.open(playerSide.get(i.qb()));
        state.addOffensivePlay();
        state.maybeCloseOnFailedFourthDown(drives, i.preSnap().down(), false);
      }
      case PlayEvent.Sack s -> {
        state.open(playerSide.get(s.qb()));
        state.addOffensivePlay();
        if (s.fumble().isPresent() && s.fumble().get().defenseRecovered()) {
          state.close(drives, DriveOutcome.TURNOVER);
        } else {
          state.maybeCloseOnFailedFourthDown(drives, s.preSnap().down(), false);
        }
      }
      case PlayEvent.Scramble s -> {
        state.open(playerSide.get(s.qb()));
        state.addOffensivePlay();
        if (s.touchdown()) {
          state.close(drives, DriveOutcome.TOUCHDOWN);
        }
      }
      case PlayEvent.Interception x -> {
        state.open(playerSide.get(x.qb()));
        state.addOffensivePlay();
        state.close(drives, x.touchdown() ? DriveOutcome.OPP_TOUCHDOWN : DriveOutcome.TURNOVER);
      }
      case PlayEvent.Run r -> {
        state.open(playerSide.get(r.carrier()));
        state.addOffensivePlay();
        if (r.fumble().isPresent() && r.fumble().get().defenseRecovered()) {
          state.close(drives, DriveOutcome.TURNOVER);
        } else if (r.touchdown()) {
          state.close(drives, DriveOutcome.TOUCHDOWN);
        } else {
          state.maybeCloseOnFailedFourthDown(drives, r.preSnap().down(), r.firstDown());
        }
      }
      case PlayEvent.FieldGoalAttempt fg ->
          state.close(
              drives,
              fg.result() == FieldGoalResult.GOOD
                  ? DriveOutcome.FIELD_GOAL
                  : DriveOutcome.MISSED_FIELD_GOAL);
      case PlayEvent.Punt p -> {
        if (p.result() == PuntResult.BLOCKED) {
          state.close(drives, DriveOutcome.TURNOVER);
        } else {
          state.close(drives, DriveOutcome.PUNT);
        }
      }
      case PlayEvent.Safety ignored -> state.close(drives, DriveOutcome.OPP_SAFETY);
      case PlayEvent.Kneel ignored -> state.addOffensivePlay();
      case PlayEvent.Spike ignored -> state.addOffensivePlay();
      case PlayEvent.EndOfQuarter q -> {
        if ((q.quarter() == 2 || q.quarter() == 4 || q.quarter() >= 5) && state.hasOpenDrive()) {
          state.close(drives, DriveOutcome.END_OF_HALF);
        }
      }
      case PlayEvent.Kickoff ignored -> {}
      case PlayEvent.ExtraPoint ignored -> {}
      case PlayEvent.TwoPointAttempt ignored -> {}
      case PlayEvent.Penalty ignored -> {}
      case PlayEvent.Timeout ignored -> {}
      case PlayEvent.TwoMinuteWarning ignored -> {}
      case PlayEvent.Injury ignored -> {}
    }
  }

  private static final class DriveState {
    private Optional<Side> offense = Optional.empty();
    private int offensivePlays;

    boolean hasOpenDrive() {
      return offense.isPresent();
    }

    int offensivePlays() {
      return offensivePlays;
    }

    void open(Side offensiveSide) {
      if (offensiveSide == null) {
        return;
      }
      if (offense.isEmpty() || offense.get() != offensiveSide) {
        offense = Optional.of(offensiveSide);
        offensivePlays = 0;
      }
    }

    void addOffensivePlay() {
      offensivePlays++;
    }

    void close(List<DriveResult> drives, DriveOutcome outcome) {
      drives.add(new DriveResult(outcome, offensivePlays));
      offense = Optional.empty();
      offensivePlays = 0;
    }

    void maybeCloseOnFailedFourthDown(List<DriveResult> drives, int down, boolean earnedFirstDown) {
      if (down == 4 && !earnedFirstDown) {
        close(drives, DriveOutcome.TURNOVER_ON_DOWNS);
      }
    }
  }
}
