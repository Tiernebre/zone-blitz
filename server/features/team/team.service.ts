import { DomainError } from "@zone-blitz/shared";
import type pino from "pino";
import type { TeamRepository } from "./team.repository.interface.ts";
import type { TeamService } from "./team.service.interface.ts";

export function createTeamService(deps: {
  teamRepo: TeamRepository;
  log: pino.Logger;
}): TeamService {
  const log = deps.log.child({ module: "team.service" });

  return {
    async getAll() {
      log.debug("fetching all teams");
      return await deps.teamRepo.getAll();
    },

    async getById(id) {
      log.debug({ id }, "fetching team by id");
      const team = await deps.teamRepo.getById(id);
      if (!team) {
        throw new DomainError("NOT_FOUND", `Team ${id} not found`);
      }
      return team;
    },
  };
}
