import type { TeamRepository } from "@zone-blitz/shared";
import type pino from "pino";
import { eq } from "drizzle-orm";
import type { Database } from "../../db/connection.ts";
import { teams } from "./team.schema.ts";

export function createTeamRepository(deps: {
  db: Database;
  log: pino.Logger;
}): TeamRepository {
  const log = deps.log.child({ module: "team.repository" });

  return {
    async getAll() {
      log.debug("fetching all teams");
      return await deps.db.select().from(teams);
    },

    async getById(id) {
      log.debug({ id }, "fetching team by id");
      const [team] = await deps.db
        .select()
        .from(teams)
        .where(eq(teams.id, id))
        .limit(1);
      return team;
    },
  };
}
