import type { Executor } from "../../db/connection.ts";
import type { PlayerTransactionType } from "@zone-blitz/shared";

export interface RecordTransactionInput {
  leagueId: string;
  teamId: string;
  playerId: string;
  type: PlayerTransactionType;
  seasonYear: number;
  counterpartyTeamId?: string;
  detail?: string;
}

export interface RosterTransactionService {
  recordAndRepublish(
    input: RecordTransactionInput,
    tx?: Executor,
  ): Promise<void>;
}
