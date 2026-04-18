package app.zoneblitz.gamesimulator.resolver;

import app.zoneblitz.gamesimulator.PlayCaller;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Player;

/**
 * Chooses what the QB does with the ball on a pass snap. Pure over {@link Roles} and the pre-snap
 * inputs; consumes randomness only for the QB's Gaussian processing noise.
 *
 * <p>Implementations encode the scoring formula from {@code sim-engine.md} lines 162-174:
 *
 * <pre>
 *   actual_openness_i    = m_route_i + depth_value(route_i) − time_penalty(depth_i, pressure)
 *   perceived_openness_i = actual_openness_i + rng.gaussian(0, σ(qb.processing, qb.footballIq))
 *   progression_bias_i   = progressionWeight(i, playCall)
 *   tendency_bias_i      = tendencyShift(qb.archetype, depth_i)
 *   score_i              = perceived_openness_i + progression_bias_i + tendency_bias_i
 * </pre>
 *
 * The selector returns {@link TargetChoice.Throw} with the argmax receiver and its route depth, or
 * one of the non-target branches ({@link TargetChoice.Scramble} / {@link TargetChoice.Throwaway} /
 * {@link TargetChoice.Sack}) when no receiver clears the threshold. R5 wires the target-identity
 * side of this contract; the pressure-driven non-throw branches get their real drivers when the
 * pass-rush sub-roll lands.
 *
 * <p>Target shares per position emerge from the interaction of per-receiver matchups and
 * progression bias — {@code position-concentration.json} WR1 / TE1 shares are the calibration
 * anchor, not a tuning dial.
 */
public interface TargetSelector {

  /**
   * Pick a {@link TargetChoice} for the supplied snap.
   *
   * <p>Implementations may consume from the parent {@link RandomSource} — the default {@link
   * ScoreBasedTargetSelector} draws one Gaussian per candidate receiver. Tests that need
   * bit-identical parity with a non-selecting baseline resolver should supply a deterministic
   * selector that draws no randomness.
   *
   * @param call the play call
   * @param roles role buckets from {@link RoleAssigner#assign}
   * @param qb the QB executing the dropback
   * @param rng randomness source
   * @return a {@link TargetChoice} describing the outcome shape and (for {@code Throw}) the target
   *     receiver and intended depth
   */
  TargetChoice select(PlayCaller.PlayCall call, Roles roles, Player qb, RandomSource rng);
}
