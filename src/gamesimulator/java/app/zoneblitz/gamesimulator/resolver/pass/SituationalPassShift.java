package app.zoneblitz.gamesimulator.resolver.pass;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.role.RoleAssignmentPair;
import java.util.Map;

/**
 * Per-outcome logit offsets for the pass outcome-mix band, conditioned on game situation. Layered
 * on top of the scalar {@link MatchupPassResolver.PassMatchupShift} that encodes talent — this
 * signal encodes "where is the offense in the down-and-distance matrix?".
 *
 * <p>Real play-by-play shows sack rate and interception rate rise together on obvious-pass downs
 * (3rd/4th and 7+) because the defense can commit to coverage and pressure without respecting the
 * run. A single scalar shift can't express this because it would also depress completion and
 * scramble probability by its β coefficients; offsets act on the target outcomes directly.
 *
 * <p>Offsets are additive in log-odds space. {@code +0.3} roughly multiplies the odds of that
 * outcome by {@code e^0.3 ≈ 1.35}. Outcomes not present in the returned map are unshifted.
 *
 * <p>Implementations may consume player attributes via {@code assignment} — e.g. a poised QB or a
 * dominant OL dampens the obvious-pass sack penalty. Average-attribute rosters must reproduce the
 * legacy situation-only offsets so the calibration baseline holds.
 */
@FunctionalInterface
interface SituationalPassShift {

  /** Identity shift — no situational offsets, used to pin baseline parity in tests. */
  SituationalPassShift ZERO = (state, assignment) -> Map.of();

  /**
   * Compute per-outcome logit offsets for the supplied pre-snap state.
   *
   * @param state pre-snap game state (down/distance is the main signal; score & clock inform
   *     garbage-time extensions in future revisions)
   * @param assignment fine-grained role-to-player mapping; implementations read attributes from
   *     this to soften or sharpen situational offsets
   * @return immutable map of outcome → logit offset; may be empty
   */
  Map<PassOutcomeKind, Double> compute(GameState state, RoleAssignmentPair assignment);
}
