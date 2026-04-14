import type pino from "pino";
import type { Database } from "../../db/connection.ts";
import { frontOfficeStaff, scouts } from "./personnel.schema.ts";
import type { PersonnelGenerator } from "./personnel.generator.interface.ts";
import type { PersonnelService } from "./personnel.service.interface.ts";
import type { PlayersService } from "../players/players.service.interface.ts";
import type { CoachesService } from "../coaches/coaches.service.interface.ts";

export function createPersonnelService(deps: {
  generator: PersonnelGenerator;
  playersService: PlayersService;
  coachesService: CoachesService;
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

      const coachesResult = await deps.coachesService.generateAndPersist({
        leagueId: input.leagueId,
        teamIds: input.teamIds,
      });

      const personnel = deps.generator.generate({
        leagueId: input.leagueId,
        teamIds: input.teamIds,
      });

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
          scouts: personnel.scouts.length,
          frontOffice: personnel.frontOfficeStaff.length,
        },
        "persisted personnel",
      );

      return {
        playerCount: playersResult.playerCount,
        coachCount: coachesResult.coachCount,
        scoutCount: personnel.scouts.length,
        frontOfficeCount: personnel.frontOfficeStaff.length,
        draftProspectCount: playersResult.draftProspectCount,
        contractCount: playersResult.contractCount,
      };
    },
  };
}
