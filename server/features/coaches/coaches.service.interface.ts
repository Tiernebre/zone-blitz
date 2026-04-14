import type { CoachDetail, CoachNode } from "@zone-blitz/shared";

export interface CoachesGenerateInput {
  leagueId: string;
  teamIds: string[];
}

export interface CoachesGenerateResult {
  coachCount: number;
}

export interface CoachesService {
  generate(
    input: CoachesGenerateInput,
  ): Promise<CoachesGenerateResult>;

  /**
   * Staff tree for a team — flat list of nodes; the client builds the
   * hierarchy from `reportsToId`.
   */
  getStaffTree(teamId: string): Promise<CoachNode[]>;

  /**
   * Full public-record detail for a single coach. Throws `DomainError`
   * with code `NOT_FOUND` when no coach has the given id.
   */
  getCoachDetail(id: string): Promise<CoachDetail>;
}
