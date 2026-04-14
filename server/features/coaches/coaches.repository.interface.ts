import type { CoachDetail, CoachNode } from "@zone-blitz/shared";

export interface CoachesRepository {
  /**
   * Returns every coach on a team as a flat list of staff-tree nodes.
   * Scoped to a league so teams that exist in multiple leagues do not
   * leak coaching staff across universes. The client builds the
   * hierarchy from `reportsToId`.
   */
  getStaffTreeByTeam(leagueId: string, teamId: string): Promise<CoachNode[]>;

  /**
   * Returns the full public-record detail view for a single coach,
   * aggregating resume, reputation, tenure results, accolades, and
   * connections. Resolves to `undefined` when no coach has the given id.
   */
  getCoachDetailById(id: string): Promise<CoachDetail | undefined>;
}
