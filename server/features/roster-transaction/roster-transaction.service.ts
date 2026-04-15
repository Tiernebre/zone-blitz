import type pino from "pino";
import type { Database } from "../../db/connection.ts";
import type { DepthChartPublisher } from "../depth-chart/depth-chart.publisher.interface.ts";
import { playerTransactions } from "../contracts/player-transaction.schema.ts";
import type { RosterTransactionService } from "./roster-transaction.service.interface.ts";

export function createRosterTransactionService(deps: {
  db: Database;
  depthChartPublisher: DepthChartPublisher;
  log: pino.Logger;
}): RosterTransactionService {
  const log = deps.log.child({ module: "roster-transaction.service" });

  return {
    async recordAndRepublish(input, tx) {
      const executor = tx ?? deps.db;

      log.info(
        { teamId: input.teamId, playerId: input.playerId, type: input.type },
        "recording roster transaction",
      );

      await executor.insert(playerTransactions).values({
        playerId: input.playerId,
        teamId: input.teamId,
        type: input.type,
        seasonYear: input.seasonYear,
        counterpartyTeamId: input.counterpartyTeamId ?? null,
        detail: input.detail ?? null,
      });

      await deps.depthChartPublisher.publishForTeams(
        { leagueId: input.leagueId, teamIds: [input.teamId] },
        tx,
      );

      log.info(
        { teamId: input.teamId, type: input.type },
        "depth chart republished after transaction",
      );
    },
  };
}
