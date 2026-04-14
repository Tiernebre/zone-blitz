import type { PlayerDetail } from "@zone-blitz/shared";
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

export interface PlayersService {
  generate(
    input: PlayersGenerateInput,
    tx?: Executor,
  ): Promise<PlayersGenerateResult>;

  getDetail(playerId: string): Promise<PlayerDetail>;
}
