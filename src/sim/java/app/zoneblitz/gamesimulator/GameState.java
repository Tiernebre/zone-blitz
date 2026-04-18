package app.zoneblitz.gamesimulator;

import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Mutable-shaped but immutable per-instance snapshot of the full state the engine needs between
 * snaps. Every field the eventual full engine requires is present here so later tasks can fill
 * values without forcing a schema-wide refactor. Pure data — no references to services, repos, or
 * any behavior beyond {@link #apply}.
 *
 * <p>Package-private per doc 804; promoted types required by {@link PlayEvent} live in their own
 * files.
 */
record GameState(
    Score score,
    GameClock clock,
    DownAndDistance downAndDistance,
    FieldPosition spot,
    Team possession,
    DriveState drive,
    Map<PlayerId, Integer> fatigueSnapCounts,
    List<PlayerId> injuredPlayers,
    int homeTimeouts,
    int awayTimeouts,
    Phase phase,
    int overtimeRound) {

  GameState {
    Objects.requireNonNull(score, "score");
    Objects.requireNonNull(clock, "clock");
    Objects.requireNonNull(downAndDistance, "downAndDistance");
    Objects.requireNonNull(spot, "spot");
    Objects.requireNonNull(possession, "possession");
    Objects.requireNonNull(drive, "drive");
    Objects.requireNonNull(fatigueSnapCounts, "fatigueSnapCounts");
    Objects.requireNonNull(injuredPlayers, "injuredPlayers");
    Objects.requireNonNull(phase, "phase");
    fatigueSnapCounts = Map.copyOf(fatigueSnapCounts);
    injuredPlayers = List.copyOf(injuredPlayers);
  }

  /** Initial state: zeros, empty collections, home possession at their own 25, regulation Q1. */
  static GameState initial() {
    return new GameState(
        new Score(0, 0),
        new GameClock(1, 15 * 60),
        new DownAndDistance(1, 10),
        new FieldPosition(25),
        Team.HOME,
        DriveState.initial(),
        Map.of(),
        List.of(),
        3,
        3,
        Phase.REGULATION,
        0);
  }

  /**
   * Produce a new state advanced past {@code event}, using {@code clock} as the post-play clock
   * snapshot. The signature is intentionally minimal for F1 — later tasks will expand it to accept
   * richer outcome and penalty payloads as those types exist. Never mutates the receiver.
   */
  GameState apply(PlayEvent event, GameClock clock) {
    Objects.requireNonNull(event, "event");
    Objects.requireNonNull(clock, "clock");
    return new GameState(
        event.scoreAfter(),
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
        overtimeRound);
  }

  /** Per-drive bookkeeping. Placeholder-sized fields for F1. */
  record DriveState(int driveNumber, int playsInDrive, int yardsInDrive, Team startingPossession) {
    static DriveState initial() {
      return new DriveState(1, 0, 0, Team.HOME);
    }
  }

  /** Game phase. */
  enum Phase {
    REGULATION,
    OVERTIME,
    FINAL
  }
}
