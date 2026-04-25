package app.zoneblitz.gamesimulator.scheme;

import app.zoneblitz.gamesimulator.roster.Coach;

/**
 * Resolves a team's coaching staff into a concrete {@link ResolvedScheme}. Vacant coordinator slots
 * are passed as the head coach duplicated — keeps {@link java.util.Optional} out of parameters per
 * project conventions and matches the existing single-coach-as-both-sides fallback pattern in
 * {@link Coach}.
 *
 * <p>The mapping rule is implementation-defined: a default implementation reads each coach's
 * archetype + tendencies and selects the best-fit {@link OffensiveSchemeId} / {@link
 * DefensiveSchemeId}, with coordinators of the play-caller archetype overriding their phase. The
 * concrete implementation lands in Phase 3.
 */
public interface SchemeResolver {

  ResolvedScheme resolve(Coach headCoach, Coach offensiveCoordinator, Coach defensiveCoordinator);
}
