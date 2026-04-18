package app.zoneblitz.gamesimulator.resolver;

/**
 * Intermediate resolution result produced by a {@link PlayResolver}, before penalty decisions,
 * clock advancement, and {@link app.zoneblitz.gamesimulator.event.PlayEvent} assembly.
 *
 * <p>Split by play-family: pass-shaped outcomes live in {@link PassOutcome}, run-shaped outcomes
 * live in {@link RunOutcome}. Kick and special-teams families will join as those resolvers land.
 */
public sealed interface PlayOutcome permits PassOutcome, RunOutcome {}
