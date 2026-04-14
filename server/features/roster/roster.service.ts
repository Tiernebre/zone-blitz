import type pino from "pino";
import type { SchemeFitLabel } from "@zone-blitz/shared";
import type { RosterRepository } from "./roster.repository.interface.ts";
import type { RosterService } from "./roster.service.interface.ts";
import type { CoachesService } from "../coaches/coaches.service.interface.ts";
import { computeSchemeFit } from "../schemes/fit.ts";

export function createRosterService(deps: {
  repo: RosterRepository;
  coachesService: CoachesService;
  log: pino.Logger;
}): RosterService {
  const log = deps.log.child({ module: "roster.service" });

  return {
    async getActiveRoster(leagueId, teamId) {
      log.debug({ leagueId, teamId }, "fetching active roster");
      return await deps.repo.getActiveRoster(leagueId, teamId);
    },

    async getDepthChart(leagueId, teamId) {
      log.debug({ leagueId, teamId }, "fetching depth chart");
      return await deps.repo.getDepthChart(leagueId, teamId);
    },

    async getStatistics(leagueId, teamId, seasonId) {
      log.debug({ leagueId, teamId, seasonId }, "fetching roster statistics");
      return await deps.repo.getStatistics(leagueId, teamId, seasonId);
    },

    async getRosterFits(leagueId, teamId) {
      log.debug({ leagueId, teamId }, "computing roster fits");
      const [fingerprint, players] = await Promise.all([
        deps.coachesService.getFingerprint(leagueId, teamId),
        deps.repo.getActivePlayersForFit(leagueId, teamId),
      ]);
      const out: Record<string, SchemeFitLabel> = {};
      for (const player of players) {
        out[player.playerId] = computeSchemeFit(
          {
            neutralBucket: player.neutralBucket,
            attributes: player.attributes,
          },
          fingerprint,
        );
      }
      return out;
    },
  };
}
