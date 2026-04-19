package app.zoneblitz.league.team;

import app.zoneblitz.league.AdvanceDay;
import app.zoneblitz.league.hiring.CandidateRandomSources;
import app.zoneblitz.league.phase.LeaguePhase;

/**
 * Per-phase CPU decision-maker. One implementation per {@link LeaguePhase} that requires CPU
 * behavior; {@link AdvanceDay} resolves the active phase's strategy and invokes {@link
 * #execute(long, long, int)} once for each CPU-controlled team on every day tick.
 *
 * <p>See {@code docs/technical/league-phases.md} "Seams" table and "Ticks" section. Strategies must
 * be deterministic given the inputs they receive and any league-scoped RNG they derive from {@link
 * CandidateRandomSources}; the day tick is the only place their side effects may commit.
 */
public interface CpuTeamStrategy {

  /** The phase this strategy handles. */
  LeaguePhase phase();

  /**
   * Execute one day of CPU behavior for the given team in the given league. Invariants:
   *
   * <ul>
   *   <li>Called inside the {@link AdvanceDay} transaction. Strategies that persist must do so
   *       through the feature's repositories so commits are atomic with the tick.
   *   <li>Phase state is read at call-time — {@code phaseDay} is the day the tick is resolving
   *       <em>before</em> increment.
   *   <li>Called only for CPU teams; implementations must not re-check ownership.
   * </ul>
   */
  void execute(long leagueId, long teamId, int phaseDay);
}
