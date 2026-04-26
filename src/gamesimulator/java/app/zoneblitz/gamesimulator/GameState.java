package app.zoneblitz.gamesimulator;

import app.zoneblitz.gamesimulator.adjustments.GameStats;
import app.zoneblitz.gamesimulator.event.DownAndDistance;
import app.zoneblitz.gamesimulator.event.FieldPosition;
import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.Side;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Mutable-shaped but immutable per-instance snapshot of the full state the engine needs between
 * snaps. Every field the eventual full engine requires is present here so later tasks can fill
 * values without forcing a schema-wide refactor. Pure data — no references to services, repos, or
 * any behavior beyond {@link #afterScrimmage} and the {@code with*} transitions.
 *
 * <p>Package-private per doc 804; promoted types required by {@link PlayEvent} live in their own
 * files.
 */
public record GameState(
    Score score,
    GameClock clock,
    DownAndDistance downAndDistance,
    FieldPosition spot,
    Side possession,
    DriveState drive,
    Map<PlayerId, Integer> fatigueSnapCounts,
    List<PlayerId> injuredPlayers,
    int homeTimeouts,
    int awayTimeouts,
    Phase phase,
    int overtimeRound,
    OvertimeState overtime,
    GameStats stats) {

  public GameState {
    Objects.requireNonNull(score, "score");
    Objects.requireNonNull(clock, "clock");
    Objects.requireNonNull(downAndDistance, "downAndDistance");
    Objects.requireNonNull(spot, "spot");
    Objects.requireNonNull(possession, "possession");
    Objects.requireNonNull(drive, "drive");
    Objects.requireNonNull(fatigueSnapCounts, "fatigueSnapCounts");
    Objects.requireNonNull(injuredPlayers, "injuredPlayers");
    Objects.requireNonNull(phase, "phase");
    Objects.requireNonNull(overtime, "overtime");
    Objects.requireNonNull(stats, "stats");
    fatigueSnapCounts = Map.copyOf(fatigueSnapCounts);
    injuredPlayers = List.copyOf(injuredPlayers);
  }

  /** Initial state: zeros, empty collections, home possession at their own 25, regulation Q1. */
  public static GameState initial() {
    return new GameState(
        new Score(0, 0),
        new GameClock(1, 15 * 60),
        new DownAndDistance(1, 10),
        new FieldPosition(25),
        Side.HOME,
        DriveState.initial(),
        Map.of(),
        List.of(),
        3,
        3,
        Phase.REGULATION,
        0,
        OvertimeState.notStarted(),
        GameStats.empty());
  }

  /**
   * Advance the state following a non-scoring, same-possession scrimmage snap: updates clock,
   * score, spot, and down/distance while keeping possession with the current offense. For
   * possession changes use {@link #withPossessionAndSpot(Side, FieldPosition)} (which also resets
   * down/distance, with goal-to-go awareness).
   */
  GameState afterScrimmage(
      PlayEvent event, GameClock clock, FieldPosition newSpot, DownAndDistance newDownAndDistance) {
    Objects.requireNonNull(event, "event");
    Objects.requireNonNull(clock, "clock");
    Objects.requireNonNull(newSpot, "newSpot");
    Objects.requireNonNull(newDownAndDistance, "newDownAndDistance");
    return new GameState(
        event.scoreAfter(),
        clock,
        newDownAndDistance,
        newSpot,
        possession,
        drive,
        fatigueSnapCounts,
        injuredPlayers,
        homeTimeouts,
        awayTimeouts,
        phase,
        overtimeRound,
        overtime,
        stats);
  }

  /** Replace the current score. Used after PAT and FG events update it on their own. */
  public GameState withScore(Score newScore) {
    Objects.requireNonNull(newScore, "newScore");
    return new GameState(
        newScore,
        clock,
        downAndDistance,
        spot,
        possession,
        drive,
        fatigueSnapCounts,
        injuredPlayers,
        homeTimeouts,
        awayTimeouts,
        phase,
        overtimeRound,
        overtime,
        stats);
  }

  /**
   * Fresh 1st-down D&D at {@code yardLine}. Goal-to-go inside the opponent's 10: yardsToGo is the
   * remaining distance to the goal line rather than 10.
   */
  static DownAndDistance freshFirstDown(int yardLine) {
    var yardsToGo = yardLine >= 90 ? 100 - yardLine : 10;
    return new DownAndDistance(1, yardsToGo);
  }

  public GameState withClock(GameClock newClock) {
    Objects.requireNonNull(newClock, "newClock");
    return new GameState(
        score,
        newClock,
        downAndDistance,
        spot,
        possession,
        drive,
        fatigueSnapCounts,
        injuredPlayers,
        homeTimeouts,
        awayTimeouts,
        phase,
        overtimeRound,
        overtime,
        stats);
  }

  public GameState withPhase(Phase newPhase) {
    Objects.requireNonNull(newPhase, "newPhase");
    return new GameState(
        score,
        clock,
        downAndDistance,
        spot,
        possession,
        drive,
        fatigueSnapCounts,
        injuredPlayers,
        homeTimeouts,
        awayTimeouts,
        newPhase,
        overtimeRound,
        overtime,
        stats);
  }

  /**
   * Decrement the calling side's remaining timeouts by one. Throws {@link IllegalStateException} if
   * the side has none left; callers are expected to check via {@link #timeoutsFor(Side)} first.
   */
  public GameState withTimeoutUsed(Side side) {
    Objects.requireNonNull(side, "side");
    var newHome = side == Side.HOME ? homeTimeouts - 1 : homeTimeouts;
    var newAway = side == Side.AWAY ? awayTimeouts - 1 : awayTimeouts;
    if (newHome < 0 || newAway < 0) {
      throw new IllegalStateException("no timeouts remaining for " + side);
    }
    return new GameState(
        score,
        clock,
        downAndDistance,
        spot,
        possession,
        drive,
        fatigueSnapCounts,
        injuredPlayers,
        newHome,
        newAway,
        phase,
        overtimeRound,
        overtime,
        stats);
  }

  /** Reset both sides' timeouts to 3 each. Invoked at half and at the start of overtime. */
  public GameState withTimeoutsReset() {
    return new GameState(
        score,
        clock,
        downAndDistance,
        spot,
        possession,
        drive,
        fatigueSnapCounts,
        injuredPlayers,
        3,
        3,
        phase,
        overtimeRound,
        overtime,
        stats);
  }

  /** Remaining timeouts for the given side. */
  public int timeoutsFor(Side side) {
    Objects.requireNonNull(side, "side");
    return side == Side.HOME ? homeTimeouts : awayTimeouts;
  }

  /**
   * Drive-change recovery fraction. Each new possession partially restores fatigue (sideline rest
   * during the change of possession). Tuned low so heavy starters still trend upward across the
   * game while short three-and-outs don't accumulate as harshly as long sustained drives.
   */
  private static final double DRIVE_RECOVERY_FRACTION = 0.10;

  public GameState withPossessionAndSpot(Side newPossession, FieldPosition newSpot) {
    Objects.requireNonNull(newPossession, "newPossession");
    Objects.requireNonNull(newSpot, "newSpot");
    var recovered = withFatigueRecovered(DRIVE_RECOVERY_FRACTION);
    return new GameState(
        recovered.score,
        recovered.clock,
        freshFirstDown(newSpot.yardLine()),
        newSpot,
        newPossession,
        recovered.drive,
        recovered.fatigueSnapCounts,
        recovered.injuredPlayers,
        recovered.homeTimeouts,
        recovered.awayTimeouts,
        recovered.phase,
        recovered.overtimeRound,
        recovered.overtime,
        recovered.stats);
  }

  public GameState withOvertimeRound(int newOvertimeRound) {
    return new GameState(
        score,
        clock,
        downAndDistance,
        spot,
        possession,
        drive,
        fatigueSnapCounts,
        injuredPlayers,
        homeTimeouts,
        awayTimeouts,
        phase,
        newOvertimeRound,
        overtime,
        stats);
  }

  /**
   * Accumulate one snap for every on-field player. Callers pass the 22 {@link PlayerId}s that
   * participated in the snap just resolved; each entry's count is incremented by one, with missing
   * entries treated as zero.
   */
  public GameState withSnapsAccumulated(List<PlayerId> onField) {
    Objects.requireNonNull(onField, "onField");
    if (onField.isEmpty()) {
      return this;
    }
    var updated = new HashMap<>(fatigueSnapCounts);
    for (var id : onField) {
      Objects.requireNonNull(id, "onField entry");
      updated.merge(id, 1, Integer::sum);
    }
    return new GameState(
        score,
        clock,
        downAndDistance,
        spot,
        possession,
        drive,
        updated,
        injuredPlayers,
        homeTimeouts,
        awayTimeouts,
        phase,
        overtimeRound,
        overtime,
        stats);
  }

  /**
   * Partially recover fatigue by scaling every player's snap count by {@code (1 - fraction)}. Used
   * between drives so that short possessions leave starters fresher. A {@code fraction} of 1.0
   * fully zeroes snap counts (halftime reset); 0.0 is a no-op.
   */
  public GameState withFatigueRecovered(double fraction) {
    if (fraction <= 0.0) {
      return this;
    }
    var clamped = Math.min(1.0, fraction);
    if (fatigueSnapCounts.isEmpty()) {
      return this;
    }
    var updated = new HashMap<PlayerId, Integer>();
    for (var entry : fatigueSnapCounts.entrySet()) {
      var snaps = entry.getValue();
      var recovered = (int) Math.round(snaps * (1.0 - clamped));
      if (recovered > 0) {
        updated.put(entry.getKey(), recovered);
      }
    }
    return new GameState(
        score,
        clock,
        downAndDistance,
        spot,
        possession,
        drive,
        updated,
        injuredPlayers,
        homeTimeouts,
        awayTimeouts,
        phase,
        overtimeRound,
        overtime,
        stats);
  }

  /**
   * Append {@code playerId} to {@link #injuredPlayers} if not already present. Idempotent — calling
   * with the same id returns the same logical state. Used by the simulator after each injury draw
   * so subsequent personnel selections skip the injured player.
   */
  public GameState withInjury(PlayerId playerId) {
    Objects.requireNonNull(playerId, "playerId");
    if (injuredPlayers.contains(playerId)) {
      return this;
    }
    var next = new ArrayList<PlayerId>(injuredPlayers.size() + 1);
    next.addAll(injuredPlayers);
    next.add(playerId);
    return new GameState(
        score,
        clock,
        downAndDistance,
        spot,
        possession,
        drive,
        fatigueSnapCounts,
        next,
        homeTimeouts,
        awayTimeouts,
        phase,
        overtimeRound,
        overtime,
        stats);
  }

  public GameState withOvertime(OvertimeState newOvertime) {
    Objects.requireNonNull(newOvertime, "newOvertime");
    return new GameState(
        score,
        clock,
        downAndDistance,
        spot,
        possession,
        drive,
        fatigueSnapCounts,
        injuredPlayers,
        homeTimeouts,
        awayTimeouts,
        phase,
        overtimeRound,
        newOvertime,
        stats);
  }

  /**
   * Add the {@link GameStats} field. Called by the simulator after each scrimmage play resolves.
   */
  public GameState withStats(GameStats newStats) {
    Objects.requireNonNull(newStats, "newStats");
    return new GameState(
        score,
        clock,
        downAndDistance,
        spot,
        possession,
        drive,
        fatigueSnapCounts,
        injuredPlayers,
        homeTimeouts,
        awayTimeouts,
        phase,
        overtimeRound,
        overtime,
        newStats);
  }

  /** Per-drive bookkeeping. */
  record DriveState(int driveNumber, int playsInDrive, int yardsInDrive, Side startingPossession) {
    static DriveState initial() {
      return new DriveState(1, 0, 0, Side.HOME);
    }
  }

  /**
   * Per-OT bookkeeping. Tracks which sides have completed a possession (drives toward modified
   * sudden-death's both-teams-possess rule) and whether the game has entered pure sudden-death
   * mode, in which any score ends the game immediately.
   */
  public record OvertimeState(boolean homePossessed, boolean awayPossessed, boolean suddenDeath) {
    public static OvertimeState notStarted() {
      return new OvertimeState(false, false, false);
    }

    public OvertimeState withPossessed(Side side) {
      Objects.requireNonNull(side, "side");
      return side == Side.HOME
          ? new OvertimeState(true, awayPossessed, suddenDeath)
          : new OvertimeState(homePossessed, true, suddenDeath);
    }

    public OvertimeState enterSuddenDeath() {
      return new OvertimeState(homePossessed, awayPossessed, true);
    }

    public boolean bothPossessed() {
      return homePossessed && awayPossessed;
    }
  }

  /** Game phase. */
  enum Phase {
    REGULATION,
    OVERTIME,
    FINAL
  }
}
