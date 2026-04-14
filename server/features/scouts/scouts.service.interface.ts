import type { ScoutDetail, ScoutNode } from "@zone-blitz/shared";
import type { Executor } from "../../db/connection.ts";

export interface ScoutsGenerateInput {
  leagueId: string;
  teamIds: string[];
}

export interface ScoutsGenerateResult {
  scoutCount: number;
}

export interface ScoutsService {
  generate(
    input: ScoutsGenerateInput,
    tx?: Executor,
  ): Promise<ScoutsGenerateResult>;

  /**
   * Staff tree for a team in a given league — flat list of nodes; the
   * client builds the hierarchy from `reportsToId`. Scoped by league so
   * the same team id across universes doesn't leak staff.
   */
  getStaffTree(leagueId: string, teamId: string): Promise<ScoutNode[]>;

  /**
   * Full public-record detail for a single scout. Throws `DomainError`
   * with code `NOT_FOUND` when no scout has the given id.
   */
  getScoutDetail(id: string): Promise<ScoutDetail>;
}
