package app.zoneblitz.league;

/**
 * Per-phase CPU decision-maker. One implementation per {@link LeaguePhase} that requires CPU
 * behavior; {@link AdvanceWeek} resolves the active phase's strategy and invokes {@link
 * #execute(long, long, int)} once for each CPU-controlled franchise on every week tick.
 *
 * <p>See {@code docs/technical/league-phases.md} "Seams" table and "Ticks" section. Strategies must
 * be deterministic given the inputs they receive and any league-scoped RNG they derive from {@link
 * CandidateRandomSources}; the week tick is the only place their side effects may commit.
 */
interface CpuFranchiseStrategy {

  /** The phase this strategy handles. */
  LeaguePhase phase();

  /**
   * Execute one week of CPU behavior for the given franchise in the given league. Invariants:
   *
   * <ul>
   *   <li>Called inside the {@link AdvanceWeek} transaction. Strategies that persist must do so
   *       through the feature's repositories so commits are atomic with the tick.
   *   <li>Phase state is read at call-time — {@code phaseWeek} is the week the tick is resolving
   *       <em>before</em> increment.
   *   <li>Called only for CPU franchises; implementations must not re-check ownership.
   * </ul>
   */
  void execute(long leagueId, long franchiseId, int phaseWeek);
}
