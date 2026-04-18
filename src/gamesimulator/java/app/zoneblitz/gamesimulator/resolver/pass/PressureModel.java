package app.zoneblitz.gamesimulator.resolver.pass;

import app.zoneblitz.gamesimulator.resolver.PassRoles;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Player;

/**
 * Resolves what happens to a QB when the pass rush has beaten protection. The outcome sampler draws
 * a nominal {@link PassOutcomeKind#SACK} from the outcome-mix band; this model then decides whether
 * the QB actually goes down, escapes for a scramble, or throws the ball away — using OL-vs-DL
 * pressure strength and QB mobility / awareness.
 *
 * <p>Implementations must be identity at average attributes: when OL, DL, and QB all sit at average
 * the model must return {@link PressureResolution#SACK} so the shipped outcome-mix stays
 * structurally intact. Extreme attributes produce directional changes — a mobile QB sees more
 * scrambles, an aware QB sees more throwaways, a dominant DL compresses both escape routes.
 */
@FunctionalInterface
interface PressureModel {

  /** No-op resolver — always returns SACK. Used to pin baseline parity in tests. */
  PressureModel ALWAYS_SACK = (roles, qb, rng) -> PressureResolution.SACK;

  /**
   * Resolve a QB-under-pressure moment into an actual outcome kind.
   *
   * @param roles pre-snap role buckets (pass blockers vs pass rushers)
   * @param qb the quarterback player
   * @param rng randomness source
   * @return one of {@link PressureResolution#SACK}, {@link PressureResolution#SCRAMBLE}, {@link
   *     PressureResolution#THROWAWAY}
   */
  PressureResolution resolve(PassRoles roles, Player qb, RandomSource rng);
}
