import type pino from "pino";
import type { Database } from "../../db/connection.ts";
import { coaches, frontOfficeStaff, scouts } from "./personnel.schema.ts";
import type { PersonnelGenerator } from "./personnel.generator.interface.ts";
import type { PersonnelService } from "./personnel.service.interface.ts";
import type { PlayersService } from "../players/players.service.interface.ts";

export function createPersonnelService(deps: {
  generator: PersonnelGenerator;
  playersService: PlayersService;
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

      const playersResult = await deps.playersService.generateAndPersist({
        leagueId: input.leagueId,
        seasonId: input.seasonId,
        teamIds: input.teamIds,
        rosterSize: input.rosterSize,
        salaryCap: input.salaryCap,
      });

      const personnel = deps.generator.generate({
        leagueId: input.leagueId,
        teamIds: input.teamIds,
      });

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

      log.info(
        {
          leagueId: input.leagueId,
          coaches: personnel.coaches.length,
          scouts: personnel.scouts.length,
          frontOffice: personnel.frontOfficeStaff.length,
        },
        "persisted personnel",
      );

      return {
        playerCount: playersResult.playerCount,
        coachCount: personnel.coaches.length,
        scoutCount: personnel.scouts.length,
        frontOfficeCount: personnel.frontOfficeStaff.length,
        draftProspectCount: playersResult.draftProspectCount,
        contractCount: playersResult.contractCount,
      };
    },
  };
}
