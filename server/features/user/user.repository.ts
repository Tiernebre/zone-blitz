import type { UserRepository } from "./user.repository.interface.ts";
import type pino from "pino";
import { eq } from "drizzle-orm";
import type { Database } from "../../db/connection.ts";
import { users } from "../auth/auth.schema.ts";

export function createUserRepository(deps: {
  db: Database;
  log: pino.Logger;
}): UserRepository {
  const log = deps.log.child({ module: "user.repository" });

  return {
    async deleteById(id) {
      log.debug({ id }, "deleting user by id");
      await deps.db.delete(users).where(eq(users.id, id));
    },
  };
}
