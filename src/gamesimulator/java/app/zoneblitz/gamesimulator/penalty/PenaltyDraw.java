package app.zoneblitz.gamesimulator.penalty;

import app.zoneblitz.gamesimulator.event.PenaltyType;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.Side;

/**
 * A penalty drawn by {@link PenaltyModel}, before the simulator has decided whether to accept or
 * enforce it. Split by timing bucket: pre-snap flags kill the snap, live-ball flags are subject to
 * accept/decline against the underlying play, post-play dead-ball flags enforce from the succeeding
 * spot.
 */
public sealed interface PenaltyDraw {

  PenaltyType type();

  Side against();

  PlayerId committedBy();

  int yards();

  PenaltyEnforcement enforcement();

  /** A dead-ball foul before the snap (false start, offside, delay, etc.). Replays the down. */
  record PreSnap(
      PenaltyType type,
      Side against,
      PlayerId committedBy,
      int yards,
      PenaltyEnforcement enforcement)
      implements PenaltyDraw {}

  /**
   * A live-ball foul committed during the snap. Whether it is enforced is decided by the
   * non-offending side via accept/decline logic outside the model.
   */
  record LiveBall(
      PenaltyType type,
      Side against,
      PlayerId committedBy,
      int yards,
      PenaltyEnforcement enforcement)
      implements PenaltyDraw {}

  /**
   * A dead-ball foul after the play has ended (unsportsmanlike, taunting). Enforced from the
   * succeeding spot and never replays the down.
   */
  record PostPlay(
      PenaltyType type,
      Side against,
      PlayerId committedBy,
      int yards,
      PenaltyEnforcement enforcement)
      implements PenaltyDraw {}
}
