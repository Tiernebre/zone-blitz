import type {
  ActiveRoster,
  DepthChart,
  RosterStatistics,
} from "@zone-blitz/shared";

export interface RosterService {
  getActiveRoster(leagueId: string, teamId: string): Promise<ActiveRoster>;
  getDepthChart(leagueId: string, teamId: string): Promise<DepthChart>;
  getStatistics(
    leagueId: string,
    teamId: string,
    seasonId: string | null,
  ): Promise<RosterStatistics>;
}
