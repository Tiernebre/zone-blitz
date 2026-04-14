import type pino from "pino";
import type { Database } from "../../db/connection.ts";
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
        insertedPlayers = await exec
          .insert(players)
          .values(generated.players.map((entry) => entry.player))
          .returning({ id: players.id, teamId: players.teamId });

        const attributeRows = insertedPlayers.map((row, index) => ({
          playerId: row.id,
          ...generated.players[index].attributes,
        }));
        await exec.insert(playerAttributes).values(attributeRows);
      }

      if (generated.draftProspects.length > 0) {
        const insertedProspects = await exec
          .insert(draftProspects)
          .values(generated.draftProspects.map((entry) => entry.prospect))
          .returning({ id: draftProspects.id });

        const prospectAttributeRows = insertedProspects.map((row, index) => ({
          draftProspectId: row.id,
          ...generated.draftProspects[index].attributes,
        }));
        await exec
          .insert(draftProspectAttributes)
          .values(prospectAttributeRows);
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
        await exec.insert(contracts).values(generatedContracts);
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
