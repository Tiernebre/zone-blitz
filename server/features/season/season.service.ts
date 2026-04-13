import type pino from "pino";
import type { SeasonRepository } from "./season.repository.interface.ts";
import type { SeasonService } from "./season.service.interface.ts";

export function createSeasonService(deps: {
  seasonRepo: SeasonRepository;
  log: pino.Logger;
}): SeasonService {
  const log = deps.log.child({ module: "season.service" });

  return {
    async getByLeagueId(leagueId) {
      log.debug({ leagueId }, "fetching seasons by league id");
      return await deps.seasonRepo.getByLeagueId(leagueId);
    },

    async getById(id) {
      log.debug({ id }, "fetching season by id");
      return await deps.seasonRepo.getById(id);
    },

    async create(input) {
      log.debug({ leagueId: input.leagueId }, "creating season");
      return await deps.seasonRepo.create(input);
    },
  };
}
