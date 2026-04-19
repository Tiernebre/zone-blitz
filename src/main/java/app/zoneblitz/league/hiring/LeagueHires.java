package app.zoneblitz.league.hiring;

import java.util.List;

/**
 * Read-side query for the league-wide hiring board on a hiring page. Returns one {@link LeagueHire}
 * per team in the league, with the team's hire from the given pool (if any) attached.
 */
public interface LeagueHires {

  /**
   * League-wide hiring board for the given pool. Rows are ordered with the viewer's team first,
   * then remaining teams alphabetically by city. Every team in the league appears exactly once,
   * whether or not they have hired from this pool yet.
   */
  List<LeagueHire> forLeaguePool(long leagueId, long userTeamId, long poolId);
}
