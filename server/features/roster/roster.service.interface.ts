import type {
  ActiveRoster,
  DepthChart,
  RosterStatistics,
  SchemeFitLabel,
} from "@zone-blitz/shared";

export interface RosterService {
  getActiveRoster(leagueId: string, teamId: string): Promise<ActiveRoster>;
  getDepthChart(leagueId: string, teamId: string): Promise<DepthChart>;
  getStatistics(
    leagueId: string,
    teamId: string,
    seasonId: string | null,
  ): Promise<RosterStatistics>;

  /**
   * Qualitative scheme-fit label for every player on the team's active
   * roster, keyed by player id. Per ADR 0005 the response is never
   * numeric — callers render it as a badge. Labels reflect the
   * currently-hired OC/DC via `coachesService.getFingerprint`, so
   * swapping a coordinator immediately shifts what this endpoint
   * returns on the next read.
   */
  getRosterFits(
    leagueId: string,
    teamId: string,
  ): Promise<Record<string, SchemeFitLabel>>;
}
