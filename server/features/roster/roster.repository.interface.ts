import type {
  ActiveRoster,
  DepthChart,
  RosterStatistics,
} from "@zone-blitz/shared";

export interface RosterRepository {
  /**
   * Active 53-man roster for a team within a league. Returns player
   * identity + contract-derived cap, injury status, contract years,
   * and per-position-group + total cap aggregates. Scoped by league
   * so the same team in a different universe isn't mixed in.
   */
  getActiveRoster(leagueId: string, teamId: string): Promise<ActiveRoster>;

  /**
   * Coach-owned depth chart snapshot for a team. Read-only: the
   * coach sim is the only writer. Missing publish produces an empty
   * slot list and null timestamps.
   */
  getDepthChart(leagueId: string, teamId: string): Promise<DepthChart>;

  /**
   * Per-player season statistics for a team. Returns an empty rows
   * array today because the sim does not yet emit stats — the page
   * renders an empty state until stats are produced.
   */
  getStatistics(
    leagueId: string,
    teamId: string,
    seasonId: string | null,
  ): Promise<RosterStatistics>;
}
