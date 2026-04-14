import type { DraftEligiblePlayer, PlayerDetail } from "@zone-blitz/shared";
import type { Executor } from "../../db/connection.ts";

export interface PlayersGenerateInput {
  leagueId: string;
  seasonId: string;
  teamIds: string[];
  rosterSize: number;
  salaryCap: number;
}

export interface PlayersGenerateResult {
  playerCount: number;
  draftProspectCount: number;
  contractCount: number;
}

export interface DraftPlayerInput {
  playerId: string;
  teamId: string;
}

export interface PlayersService {
  generate(
    input: PlayersGenerateInput,
    tx?: Executor,
  ): Promise<PlayersGenerateResult>;

  getDetail(playerId: string): Promise<PlayerDetail>;

  findDraftEligiblePlayers(leagueId: string): Promise<DraftEligiblePlayer[]>;

  /**
   * Atomic `prospect → active` transition for a single player. The only
   * code path allowed to flip `players.status` out of `prospect`.
   * Throws NOT_FOUND when the player does not exist or is no longer a
   * prospect (already drafted, retired, etc.).
   */
  draftPlayer(input: DraftPlayerInput): Promise<void>;
}
