import type { UserRepository } from "./user.repository.interface.ts";
import type { UserService } from "./user.service.interface.ts";
import type pino from "pino";

export function createUserService(deps: {
  userRepo: UserRepository;
  log: pino.Logger;
}): UserService {
  const log = deps.log.child({ module: "user.service" });

  return {
    async deleteById(id) {
      log.info({ id }, "deleting user account");
      await deps.userRepo.deleteById(id);
    },
  };
}
