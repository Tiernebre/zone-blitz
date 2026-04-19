package app.zoneblitz.gamesimulator.event;

import java.util.List;
import java.util.Optional;

/**
 * A single event emitted by the simulation engine. Each variant represents one of the atomic things
 * that can happen on or between snaps. The {@code sealed} declaration below is a pre-carved
 * hotspot: later tasks fill in variant bodies but never edit the sealed interface or permits list.
 */
public sealed interface PlayEvent
    permits PlayEvent.PassComplete,
        PlayEvent.PassIncomplete,
        PlayEvent.Sack,
        PlayEvent.Scramble,
        PlayEvent.Interception,
        PlayEvent.Run,
        PlayEvent.FieldGoalAttempt,
        PlayEvent.ExtraPoint,
        PlayEvent.TwoPointAttempt,
        PlayEvent.Punt,
        PlayEvent.Kickoff,
        PlayEvent.Penalty,
        PlayEvent.Safety,
        PlayEvent.Kneel,
        PlayEvent.Spike,
        PlayEvent.Timeout,
        PlayEvent.TwoMinuteWarning,
        PlayEvent.EndOfQuarter,
        PlayEvent.Injury {

  /** The play's stable identifier. */
  PlayId id();

  /** The game this play belongs to. */
  GameId gameId();

  /** Monotonic sequence number within the game, starting at 0. */
  int sequence();

  /** Down and distance at the start of the play. */
  DownAndDistance preSnap();

  /** Ball spot at the start of the play. */
  FieldPosition preSnapSpot();

  /** Game clock at the start of the play. */
  GameClock clockBefore();

  /** Game clock after the play resolves. */
  GameClock clockAfter();

  /** Running score after the play. */
  Score scoreAfter();

  record PassComplete(
      PlayId id,
      GameId gameId,
      int sequence,
      DownAndDistance preSnap,
      FieldPosition preSnapSpot,
      GameClock clockBefore,
      GameClock clockAfter,
      Score scoreAfter,
      PlayerId qb,
      PlayerId target,
      int airYards,
      int yardsAfterCatch,
      int totalYards,
      FieldPosition endSpot,
      Optional<PlayerId> tackler,
      List<PlayerId> defendersInCoverage,
      boolean touchdown,
      boolean firstDown)
      implements PlayEvent {}

  record PassIncomplete(
      PlayId id,
      GameId gameId,
      int sequence,
      DownAndDistance preSnap,
      FieldPosition preSnapSpot,
      GameClock clockBefore,
      GameClock clockAfter,
      Score scoreAfter,
      PlayerId qb,
      PlayerId target,
      int airYards,
      IncompleteReason reason,
      Optional<PlayerId> defender)
      implements PlayEvent {}

  record Sack(
      PlayId id,
      GameId gameId,
      int sequence,
      DownAndDistance preSnap,
      FieldPosition preSnapSpot,
      GameClock clockBefore,
      GameClock clockAfter,
      Score scoreAfter,
      PlayerId qb,
      List<PlayerId> sackers,
      int yardsLost,
      Optional<FumbleOutcome> fumble)
      implements PlayEvent {}

  record Scramble(
      PlayId id,
      GameId gameId,
      int sequence,
      DownAndDistance preSnap,
      FieldPosition preSnapSpot,
      GameClock clockBefore,
      GameClock clockAfter,
      Score scoreAfter,
      PlayerId qb,
      int yards,
      FieldPosition endSpot,
      Optional<PlayerId> tackler,
      boolean slideOrOob,
      boolean touchdown)
      implements PlayEvent {}

  record Interception(
      PlayId id,
      GameId gameId,
      int sequence,
      DownAndDistance preSnap,
      FieldPosition preSnapSpot,
      GameClock clockBefore,
      GameClock clockAfter,
      Score scoreAfter,
      PlayerId qb,
      PlayerId intendedTarget,
      PlayerId interceptor,
      int returnYards,
      FieldPosition endSpot,
      boolean touchdown)
      implements PlayEvent {}

  record Run(
      PlayId id,
      GameId gameId,
      int sequence,
      DownAndDistance preSnap,
      FieldPosition preSnapSpot,
      GameClock clockBefore,
      GameClock clockAfter,
      Score scoreAfter,
      PlayerId carrier,
      RunConcept concept,
      int yards,
      FieldPosition endSpot,
      Optional<PlayerId> tackler,
      Optional<FumbleOutcome> fumble,
      boolean touchdown,
      boolean firstDown,
      long rngDraw)
      implements PlayEvent {}

  record FieldGoalAttempt(
      PlayId id,
      GameId gameId,
      int sequence,
      DownAndDistance preSnap,
      FieldPosition preSnapSpot,
      GameClock clockBefore,
      GameClock clockAfter,
      Score scoreAfter,
      PlayerId kicker,
      int distance,
      FieldGoalResult result,
      Optional<PlayerId> blocker)
      implements PlayEvent {}

  record ExtraPoint(
      PlayId id,
      GameId gameId,
      int sequence,
      DownAndDistance preSnap,
      FieldPosition preSnapSpot,
      GameClock clockBefore,
      GameClock clockAfter,
      Score scoreAfter,
      PlayerId kicker,
      PatResult result)
      implements PlayEvent {}

  record TwoPointAttempt(
      PlayId id,
      GameId gameId,
      int sequence,
      DownAndDistance preSnap,
      FieldPosition preSnapSpot,
      GameClock clockBefore,
      GameClock clockAfter,
      Score scoreAfter,
      TwoPointPlay play,
      boolean success)
      implements PlayEvent {}

  record Punt(
      PlayId id,
      GameId gameId,
      int sequence,
      DownAndDistance preSnap,
      FieldPosition preSnapSpot,
      GameClock clockBefore,
      GameClock clockAfter,
      Score scoreAfter,
      PlayerId punter,
      int grossYards,
      Optional<PlayerId> returner,
      int returnYards,
      PuntResult result)
      implements PlayEvent {}

  record Kickoff(
      PlayId id,
      GameId gameId,
      int sequence,
      DownAndDistance preSnap,
      FieldPosition preSnapSpot,
      GameClock clockBefore,
      GameClock clockAfter,
      Score scoreAfter,
      PlayerId kicker,
      KickoffResult result,
      Optional<PlayerId> returner,
      int returnYards,
      boolean onside)
      implements PlayEvent {}

  record Penalty(
      PlayId id,
      GameId gameId,
      int sequence,
      DownAndDistance preSnap,
      FieldPosition preSnapSpot,
      GameClock clockBefore,
      GameClock clockAfter,
      Score scoreAfter,
      PenaltyType type,
      Side against,
      PlayerId committedBy,
      int yards,
      boolean replayDown,
      Optional<PlayEvent> underlyingPlay)
      implements PlayEvent {}

  /**
   * Emitted immediately after the triggering play event whenever that play resulted in a safety.
   * The {@link #scoreAfter} matches the scoring math already applied on the triggering event (+2 to
   * the defense). {@link #spot} is the free-kick spot awarded to the scoring team — today the ball
   * is placed directly at that team's own 20 (a simplification; full free-kick modeling is a
   * follow-up). {@link #concedingSide} is the side that gave up the two points (the offense on the
   * triggering play).
   */
  record Safety(
      PlayId id,
      GameId gameId,
      int sequence,
      DownAndDistance preSnap,
      FieldPosition preSnapSpot,
      GameClock clockBefore,
      GameClock clockAfter,
      Score scoreAfter,
      FieldPosition spot,
      Side concedingSide)
      implements PlayEvent {}

  record Kneel(
      PlayId id,
      GameId gameId,
      int sequence,
      DownAndDistance preSnap,
      FieldPosition preSnapSpot,
      GameClock clockBefore,
      GameClock clockAfter,
      Score scoreAfter)
      implements PlayEvent {}

  record Spike(
      PlayId id,
      GameId gameId,
      int sequence,
      DownAndDistance preSnap,
      FieldPosition preSnapSpot,
      GameClock clockBefore,
      GameClock clockAfter,
      Score scoreAfter)
      implements PlayEvent {}

  record Timeout(
      PlayId id,
      GameId gameId,
      int sequence,
      DownAndDistance preSnap,
      FieldPosition preSnapSpot,
      GameClock clockBefore,
      GameClock clockAfter,
      Score scoreAfter,
      Side team)
      implements PlayEvent {}

  record TwoMinuteWarning(
      PlayId id,
      GameId gameId,
      int sequence,
      DownAndDistance preSnap,
      FieldPosition preSnapSpot,
      GameClock clockBefore,
      GameClock clockAfter,
      Score scoreAfter)
      implements PlayEvent {}

  record EndOfQuarter(
      PlayId id,
      GameId gameId,
      int sequence,
      DownAndDistance preSnap,
      FieldPosition preSnapSpot,
      GameClock clockBefore,
      GameClock clockAfter,
      Score scoreAfter,
      int quarter)
      implements PlayEvent {}

  /**
   * A player injury emitted immediately after the snap that caused it. {@link #scoreAfter} and
   * {@link #clockAfter} match the triggering play's tail values — the injury does not move the
   * clock on its own. {@link #severity} drives how long the player is unavailable.
   */
  record Injury(
      PlayId id,
      GameId gameId,
      int sequence,
      DownAndDistance preSnap,
      FieldPosition preSnapSpot,
      GameClock clockBefore,
      GameClock clockAfter,
      Score scoreAfter,
      PlayerId player,
      Side side,
      InjurySeverity severity)
      implements PlayEvent {}
}
