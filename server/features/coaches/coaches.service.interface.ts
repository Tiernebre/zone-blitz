import type {
  CoachDetail,
  CoachNode,
  SchemeFingerprint,
} from "@zone-blitz/shared";
import type { Executor } from "../../db/connection.ts";

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
    tx?: Executor,
  ): Promise<CoachesGenerateResult>;

  /**
   * Staff tree for a team in a given league — flat list of nodes; the
   * client builds the hierarchy from `reportsToId`. Scoping by league
   * prevents staff from other universes leaking through when the same
   * team id is reused across leagues.
   */
  getStaffTree(leagueId: string, teamId: string): Promise<CoachNode[]>;

  /**
   * Full public-record detail for a single coach. Throws `DomainError`
   * with code `NOT_FOUND` when no coach has the given id.
   */
  getCoachDetail(id: string): Promise<CoachDetail>;

  /**
   * Composed scheme fingerprint for the team, per ADR 0007. Never
   * persisted — built on read from the current OC's offensive tendency
   * vector and DC's defensive tendency vector. Either side resolves to
   * `null` when the slot is vacant or the coordinator has no tendency
   * row yet (e.g. HC-only rosters during generation transitions).
   */
  getFingerprint(
    leagueId: string,
    teamId: string,
  ): Promise<SchemeFingerprint>;
}
