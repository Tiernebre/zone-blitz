import type { LeagueRepository } from "./league.repository.interface.ts";
import type pino from "pino";
import { eq } from "drizzle-orm";
import type { Database } from "../../db/connection.ts";
import { leagues } from "./league.schema.ts";

export function createLeagueRepository(deps: {
  db: Database;
  log: pino.Logger;
}): LeagueRepository {
  const log = deps.log.child({ module: "league.repository" });

  return {
    async getAll() {
      log.debug("fetching all leagues");
      return await deps.db.select().from(leagues);
    },

    async getById(id) {
      log.debug({ id }, "fetching league by id");
      const [league] = await deps.db
        .select()
        .from(leagues)
        .where(eq(leagues.id, id))
        .limit(1);
      return league;
    },

    async create(input) {
      log.debug({ name: input.name }, "creating league");
      const [league] = await deps.db
        .insert(leagues)
        .values({ name: input.name })
        .returning();
      return league;
    },

    async deleteById(id) {
      log.debug({ id }, "deleting league by id");
      await deps.db.delete(leagues).where(eq(leagues.id, id));
    },
  };
}
