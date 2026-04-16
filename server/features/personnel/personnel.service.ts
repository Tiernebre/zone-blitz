import type pino from "pino";
import type { PersonnelService } from "./personnel.service.interface.ts";
import type { PlayersService } from "../players/players.service.interface.ts";
import type { CoachesService } from "../coaches/coaches.service.interface.ts";
import type { ScoutsService } from "../scouts/scouts.service.interface.ts";
import type { FrontOfficeService } from "../front-office/front-office.service.interface.ts";
import type { DepthChartPublisher } from "../depth-chart/depth-chart.publisher.interface.ts";

export function createPersonnelService(deps: {
  playersService: PlayersService;
  coachesService: CoachesService;
  scoutsService: ScoutsService;
  frontOfficeService: FrontOfficeService;
  depthChartPublisher: DepthChartPublisher;
  log: pino.Logger;
}): PersonnelService {
  const log = deps.log.child({ module: "personnel.service" });

  return {
    async generate(input, tx) {
      log.info(
        { leagueId: input.leagueId, seasonId: input.seasonId },
        "generating personnel",
      );

      const playersResult = await deps.playersService.generate({
        leagueId: input.leagueId,
        seasonId: input.seasonId,
        teamIds: [],
        rosterSize: 0,
        salaryCap: input.salaryCap,
      }, tx);

      const poolResult = await deps.coachesService.generatePool({
        leagueId: input.leagueId,
        numberOfTeams: input.teamIds.length,
      }, tx);

      log.info(
        { leagueId: input.leagueId, poolSize: poolResult.coachCount },
        "generated coaching candidate pool",
      );

      const depthChartResult = await deps.depthChartPublisher.publishForTeams({
        leagueId: input.leagueId,
        teamIds: input.teamIds,
      }, tx);

      log.info(
        { depthChartEntries: depthChartResult.entryCount },
        "published initial depth charts",
      );

      const scoutsResult = await deps.scoutsService.generatePool({
        leagueId: input.leagueId,
        numberOfTeams: input.teamIds.length,
      }, tx);

      log.info(
        { leagueId: input.leagueId, poolSize: scoutsResult.scoutCount },
        "generated scouting candidate pool",
      );

      const frontOfficeResult = await deps.frontOfficeService
        .generate({
          leagueId: input.leagueId,
          teamIds: input.teamIds,
        }, tx);

      return {
        playerCount: playersResult.playerCount,
        coachCount: poolResult.coachCount,
        scoutCount: scoutsResult.scoutCount,
        frontOfficeCount: frontOfficeResult.frontOfficeCount,
        draftProspectCount: playersResult.draftProspectCount,
        contractCount: playersResult.contractCount,
      };
    },
  };
}
