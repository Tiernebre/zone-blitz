import type pino from "pino";
import type { Database } from "../../db/connection.ts";
import {
  coaches,
  draftProspects,
  frontOfficeStaff,
  players,
  scouts,
} from "./personnel.schema.ts";
import { contracts } from "./contract.schema.ts";
import type { PersonnelGenerator } from "./personnel.generator.interface.ts";
import type { PersonnelService } from "./personnel.service.interface.ts";

export function createPersonnelService(deps: {
  generator: PersonnelGenerator;
  db: Database;
  log: pino.Logger;
}): PersonnelService {
  const log = deps.log.child({ module: "personnel.service" });

  return {
    async generateAndPersist(input) {
      log.info(
        { leagueId: input.leagueId, seasonId: input.seasonId },
        "generating personnel",
      );

      const personnel = deps.generator.generate({
        leagueId: input.leagueId,
        seasonId: input.seasonId,
        teamIds: input.teamIds,
        rosterSize: input.rosterSize,
      });

      let insertedPlayers: { id: string; teamId: string | null }[] = [];

      if (personnel.players.length > 0) {
        insertedPlayers = await deps.db
          .insert(players)
          .values(personnel.players)
          .returning({ id: players.id, teamId: players.teamId });
      }

      if (personnel.coaches.length > 0) {
        await deps.db.insert(coaches).values(personnel.coaches);
      }
      if (personnel.scouts.length > 0) {
        await deps.db.insert(scouts).values(personnel.scouts);
      }
      if (personnel.frontOfficeStaff.length > 0) {
        await deps.db
          .insert(frontOfficeStaff)
          .values(personnel.frontOfficeStaff);
      }
      if (personnel.draftProspects.length > 0) {
        await deps.db.insert(draftProspects).values(personnel.draftProspects);
      }

      log.info(
        {
          leagueId: input.leagueId,
          players: insertedPlayers.length,
          coaches: personnel.coaches.length,
          scouts: personnel.scouts.length,
          frontOffice: personnel.frontOfficeStaff.length,
          draftProspects: personnel.draftProspects.length,
        },
        "persisted personnel",
      );

      const generatedContracts = deps.generator.generateContracts({
        salaryCap: input.salaryCap,
        players: insertedPlayers,
      });

      if (generatedContracts.length > 0) {
        await deps.db.insert(contracts).values(generatedContracts);
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
        coachCount: personnel.coaches.length,
        scoutCount: personnel.scouts.length,
        frontOfficeCount: personnel.frontOfficeStaff.length,
        draftProspectCount: personnel.draftProspects.length,
        contractCount: generatedContracts.length,
      };
    },
  };
}
