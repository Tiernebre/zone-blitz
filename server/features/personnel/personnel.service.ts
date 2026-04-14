import type pino from "pino";
import type { PersonnelService } from "./personnel.service.interface.ts";
import type { PlayersService } from "../players/players.service.interface.ts";
import type { CoachesService } from "../coaches/coaches.service.interface.ts";
import type { ScoutsService } from "../scouts/scouts.service.interface.ts";
import type { FrontOfficeService } from "../front-office/front-office.service.interface.ts";

export function createPersonnelService(deps: {
  playersService: PlayersService;
  coachesService: CoachesService;
  scoutsService: ScoutsService;
  frontOfficeService: FrontOfficeService;
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

      const scoutsResult = await deps.scoutsService.generateAndPersist({
        leagueId: input.leagueId,
        teamIds: input.teamIds,
      });

      const frontOfficeResult = await deps.frontOfficeService
        .generateAndPersist({
          leagueId: input.leagueId,
          teamIds: input.teamIds,
        });

      return {
        playerCount: playersResult.playerCount,
        coachCount: coachesResult.coachCount,
        scoutCount: scoutsResult.scoutCount,
        frontOfficeCount: frontOfficeResult.frontOfficeCount,
        draftProspectCount: playersResult.draftProspectCount,
        contractCount: playersResult.contractCount,
      };
    },
  };
}
