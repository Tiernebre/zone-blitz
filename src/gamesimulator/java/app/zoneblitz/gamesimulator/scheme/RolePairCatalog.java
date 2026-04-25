package app.zoneblitz.gamesimulator.scheme;

import app.zoneblitz.gamesimulator.event.ConceptFamily;
import app.zoneblitz.gamesimulator.formation.CoverageShell;
import app.zoneblitz.gamesimulator.formation.OffensiveFormation;
import app.zoneblitz.gamesimulator.role.RolePair;
import java.util.List;

/**
 * Resolves the per-snap list of role-vs-role matchups the resolver should iterate, given the
 * concept being run, the offensive formation, and the defensive coverage shell. Implementations are
 * derived from a {@code (OffensiveScheme, DefensiveScheme)} pairing and computed once per game —
 * per-snap calls are map lookups, not search.
 *
 * <p>The returned list represents the additive contributions to the matchup shift; pair weights
 * reflect "how much does winning this matchup move the outcome on this concept."
 */
public interface RolePairCatalog {

  List<RolePair> pairsFor(ConceptFamily concept, OffensiveFormation formation, CoverageShell shell);
}
