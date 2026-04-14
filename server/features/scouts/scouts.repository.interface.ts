import type { ScoutDetail, ScoutNode } from "@zone-blitz/shared";

export interface ScoutsRepository {
  /**
   * Returns every scout on a team as a flat list of staff-tree nodes.
   * Scoped to a league so teams that exist in multiple leagues do not
   * leak scouting staff across universes. The client builds the
   * hierarchy from `reportsToId`.
   */
  getStaffTreeByTeam(leagueId: string, teamId: string): Promise<ScoutNode[]>;

  /**
   * Returns the full public-record detail view for a single scout,
   * aggregating resume, reputation, tenure evaluations, cross-checks,
   * external record, and connections. Resolves to `undefined` when no
   * scout has the given id.
   */
  getScoutDetailById(id: string): Promise<ScoutDetail | undefined>;
}
