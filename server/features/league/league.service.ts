import type { LeagueRepository, LeagueService } from "@zone-blitz/shared";
import { DomainError } from "@zone-blitz/shared";
import type pino from "pino";

export function createLeagueService(deps: {
  leagueRepo: LeagueRepository;
  log: pino.Logger;
}): LeagueService {
  const log = deps.log.child({ module: "league.service" });

  return {
    async getAll() {
      log.debug("fetching all leagues");
      return deps.leagueRepo.getAll();
    },

    async getById(id) {
      log.debug({ id }, "fetching league by id");
      const league = await deps.leagueRepo.getById(id);
      if (!league) {
        throw new DomainError("NOT_FOUND", `League ${id} not found`);
      }
      return league;
    },

    async create(input) {
      log.info({ name: input.name }, "creating league");
      return deps.leagueRepo.create(input);
    },
  };
}
