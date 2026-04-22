package app.zoneblitz.league.hiring;

import app.zoneblitz.league.phase.LeaguePhase;

/**
 * Phase-entry seam that generates and persists the candidate pool for a hiring phase. No-op when a
 * pool already exists for the given {@code (league, phase, pool type)} triple — call sites rely on
 * this to make phase re-entry idempotent (autofill/recovery).
 *
 * <p>On first entry, a new {@link CandidatePool} row is inserted, the generator produces {@code
 * poolSize} candidates using a deterministic {@code RandomSource} derived from {@code (leagueId,
 * phase)}, and each generated candidate plus its preferences row is persisted. The hidden-info
 * contract in {@link CandidateGenerator}'s Javadoc is upheld: generators must not leak true ratings
 * into price signals.
 */
public interface GenerateCandidatePool {

  /**
   * Generate the pool if one is not already present.
   *
   * @param leagueId the league the pool belongs to.
   * @param phase the hiring phase the pool is scoped to (e.g. {@link
   *     LeaguePhase#HIRING_HEAD_COACH}).
   * @param poolType the pool type variant.
   * @param generator the candidate generator to run when a new pool is needed; consumers pass a
   *     phase-appropriate implementation (e.g. head-coach generator for HC phase).
   * @param poolSize how many candidates to generate. Must be {@code > 0}. Ignored when an existing
   *     pool is found.
   * @return {@code true} if a new pool was created; {@code false} when an existing pool was found
   *     and the call was a no-op.
   */
  boolean generateIfAbsent(
      long leagueId,
      LeaguePhase phase,
      CandidatePoolType poolType,
      CandidateGenerator generator,
      int poolSize);
}
