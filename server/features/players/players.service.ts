import type pino from "pino";
import type { Database } from "../../db/connection.ts";
import {
  chunkedInsert,
  chunkedInsertReturning,
} from "../../db/chunked-insert.ts";
import { draftProspects, players } from "./player.schema.ts";
import {
  draftProspectAttributes,
  playerAttributes,
} from "./attributes.schema.ts";
import { contracts } from "./contract.schema.ts";
import type { PlayersGenerator } from "./players.generator.interface.ts";
import type { PlayersService } from "./players.service.interface.ts";

export function createPlayersService(deps: {
  generator: PlayersGenerator;
  db: Database;
  log: pino.Logger;
}): PlayersService {
  const log = deps.log.child({ module: "players.service" });

  return {
    async generate(input, tx) {
      const exec = tx ?? deps.db;
      log.info(
        { leagueId: input.leagueId, seasonId: input.seasonId },
        "generating players",
      );

      const generated = deps.generator.generate({
        leagueId: input.leagueId,
        seasonId: input.seasonId,
        teamIds: input.teamIds,
        rosterSize: input.rosterSize,
      });

      let insertedPlayers: { id: string; teamId: string | null }[] = [];

      if (generated.players.length > 0) {
        insertedPlayers = await chunkedInsertReturning<
          { id: string; teamId: string | null }
        >(
          exec,
          players,
          generated.players.map((entry) => entry.player),
          { id: players.id, teamId: players.teamId },
        );

        const attributeRows = insertedPlayers.map((row, index) => ({
          playerId: row.id,
          ...generated.players[index].attributes,
        }));
        await chunkedInsert(exec, playerAttributes, attributeRows);
      }

      if (generated.draftProspects.length > 0) {
        const insertedProspects = await chunkedInsertReturning<{ id: string }>(
          exec,
          draftProspects,
          generated.draftProspects.map((entry) => entry.prospect),
          { id: draftProspects.id },
        );

        const prospectAttributeRows = insertedProspects.map((row, index) => ({
          draftProspectId: row.id,
          ...generated.draftProspects[index].attributes,
        }));
        await chunkedInsert(
          exec,
          draftProspectAttributes,
          prospectAttributeRows,
        );
      }

      log.info(
        {
          leagueId: input.leagueId,
          players: insertedPlayers.length,
          draftProspects: generated.draftProspects.length,
        },
        "persisted players",
      );

      const generatedContracts = deps.generator.generateContracts({
        salaryCap: input.salaryCap,
        players: insertedPlayers,
      });

      if (generatedContracts.length > 0) {
        await chunkedInsert(exec, contracts, generatedContracts);
      }

      log.info(
        {
          leagueId: input.leagueId,
          contracts: generatedContracts.length,
        },
        "persisted contracts",
      );

      return {
        playerCount: insertedPlayers.length,
        draftProspectCount: generated.draftProspects.length,
        contractCount: generatedContracts.length,
      };
    },
  };
}
