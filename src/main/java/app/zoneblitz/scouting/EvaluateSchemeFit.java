package app.zoneblitz.scouting;

import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.scheme.ResolvedScheme;

/**
 * Evaluates a player's fit within a scheme, returning a scheme-relative {@link SchemeFit}.
 *
 * <p>Architectural guardrail against a re-introduction of OVR: tier ranking requires the caller to
 * supply a comparison pool. There is no overload that returns a tier without a pool — the absence
 * of a pool is a missing-argument compile error, not a default-to-global-percentile fallback.
 */
public interface EvaluateSchemeFit {

  SchemeFit evaluate(Player player, ResolvedScheme scheme, Iterable<Player> roleComparisonPool);
}
