import { DomainError } from "@zone-blitz/shared";
import type pino from "pino";
import type { FranchiseRepository } from "./franchise.repository.ts";
import type { FranchiseService } from "./franchise.service.interface.ts";

export function createFranchiseService(deps: {
  franchiseRepo: FranchiseRepository;
  log: pino.Logger;
}): FranchiseService {
  const log = deps.log.child({ module: "franchise.service" });

  return {
    async getAll() {
      log.debug("fetching all franchises");
      return await deps.franchiseRepo.getAll();
    },

    async getById(id) {
      log.debug({ id }, "fetching franchise by id");
      const franchise = await deps.franchiseRepo.getById(id);
      if (!franchise) {
        throw new DomainError("NOT_FOUND", `Franchise ${id} not found`);
      }
      return franchise;
    },
  };
}
