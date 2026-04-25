package app.zoneblitz.gamesimulator.penalty;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.PlayCaller;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.personnel.DefensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.resolver.PlayOutcome;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Coach;
import java.util.Optional;

/**
 * Draws penalties at the three timing boundaries around a scrimmage snap. Each method is called
 * exactly once per snap; a method either returns a flag (for the single type that fired) or empty.
 * Simultaneous multi-flag situations (offsetting, pick-one) are not modeled in this layer.
 *
 * <p>The model only draws — it does not enforce. {@link PenaltyEnforcer} turns a {@link
 * PenaltyDraw} into a {@link GameState} transition, and {@code GameSimulator} decides accept /
 * decline for {@link PenaltyDraw.LiveBall} against the underlying play.
 */
public interface PenaltyModel {

  /**
   * Draw a dead-ball pre-snap foul. Called before the offensive resolver runs. If present, the snap
   * does not execute: the penalty is enforced, the down is replayed, and a small amount of clock
   * ticks. Offensive and defensive coach {@link Coach#quality()} {@code preparation} scales rates
   * for the matching side — pre-snap fouls are the canonical preparation signal.
   *
   * @param state pre-snap game state (spot, down/distance, clock, possession)
   * @param offense offensive personnel that would have taken the snap
   * @param defense defensive personnel that would have taken the snap
   * @param offenseCoach coach of the side on offense
   * @param defenseCoach coach of the side on defense
   * @param rng random source scoped to this snap
   * @return a draw, or empty if no foul fires this snap
   */
  Optional<PenaltyDraw.PreSnap> preSnap(
      GameState state,
      OffensivePersonnel offense,
      DefensivePersonnel defense,
      Coach offenseCoach,
      Coach defenseCoach,
      RandomSource rng);

  /**
   * Draw a live-ball foul committed during the snap. The caller retains the resolved {@link
   * PlayOutcome} and decides accept/decline by comparing outcomes.
   *
   * @param call the offensive call that was run
   * @param outcome the play's intermediate outcome as produced by the resolver
   * @param state pre-snap game state
   * @param offense offensive personnel on the snap
   * @param defense defensive personnel on the snap
   * @param rng random source scoped to this snap
   * @return a draw, or empty if no flag fires
   */
  Optional<PenaltyDraw.LiveBall> duringPlay(
      PlayCaller.PlayCall call,
      PlayOutcome outcome,
      GameState state,
      OffensivePersonnel offense,
      DefensivePersonnel defense,
      RandomSource rng);

  /**
   * Draw a post-play dead-ball foul (unsportsmanlike conduct, taunting). Enforced from the
   * succeeding spot and does not replay the down.
   *
   * @param offenseSide which side was on offense
   * @param offense offensive personnel on the snap
   * @param defense defensive personnel on the snap
   * @param rng random source scoped to this snap
   * @return a draw, or empty if no flag fires
   */
  Optional<PenaltyDraw.PostPlay> postPlay(
      Side offenseSide, OffensivePersonnel offense, DefensivePersonnel defense, RandomSource rng);
}
