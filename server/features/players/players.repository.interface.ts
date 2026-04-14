import type { DraftEligiblePlayer, PlayerDetail } from "@zone-blitz/shared";
import type { Executor } from "../../db/connection.ts";

export interface PlayersRepository {
  /**
   * Full public record for one player: header identity, current team,
   * and origin (draft slot, drafting team, college, hometown). Never
   * surfaces hidden attributes, potential, or scout grades — those
   * belong behind the scouting wall.
   *
   * Returns undefined when the id does not resolve.
   */
  getDetailById(playerId: string): Promise<PlayerDetail | undefined>;

  /**
   * Every player in the league currently in the draft pool —
   * `status = 'prospect'` — joined with their immutable pre-draft
   * profile. Ordered by projected round (nulls last) then last name.
   */
  findDraftEligiblePlayers(leagueId: string): Promise<DraftEligiblePlayer[]>;

  /**
   * Flip a single player from `status = 'prospect'` to `status = 'active'`
   * and set their team. Guarded against double-draft by the `status` filter
   * in the WHERE clause — the caller gets `"not_found"` back when nothing
   * matches (player missing, already active, or already retired), which it
   * can translate into a domain error. Returns `"ok"` when the row flipped.
   *
   * Intended to run inside a service-owned transaction so the draft-pick
   * record and the status flip commit atomically.
   */
  transitionProspectToActive(
    input: { playerId: string; teamId: string },
    tx?: Executor,
  ): Promise<"ok" | "not_found">;
}
