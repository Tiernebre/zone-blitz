package app.zoneblitz.league;

import java.util.List;

/**
 * Read-side companion to {@link TeamRepository} for features that need to know which teams belong
 * to a league. Kept separate so the write-side repository stays insert-only.
 */
interface TeamLookup {

  /** Return the team ids participating in the given league, ordered by team id. */
  List<Long> teamIdsForLeague(long leagueId);

  /**
   * Return the team ids participating in the given league whose {@code owner_subject} is null —
   * i.e. the CPU-controlled teams. Ordered by team id. Used by {@link AdvanceWeek} to dispatch
   * {@code CpuTeamStrategy} per non-user team.
   */
  List<Long> cpuTeamIdsForLeague(long leagueId);
}
