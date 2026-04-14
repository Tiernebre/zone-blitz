import type pino from "pino";
import type { RosterRepository } from "./roster.repository.interface.ts";
import type { RosterService } from "./roster.service.interface.ts";

export function createRosterService(deps: {
  repo: RosterRepository;
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
  };
}
