import type { LeagueRepository } from "./league.repository.interface.ts";
import type pino from "pino";
import { desc, eq, sql } from "drizzle-orm";
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
      return await deps.db
        .select()
        .from(leagues)
        .orderBy(
          sql`${leagues.lastPlayedAt} desc nulls last`,
          desc(leagues.createdAt),
        );
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

    async create(input, tx) {
      log.debug({ name: input.name }, "creating league");
      const [league] = await (tx ?? deps.db)
        .insert(leagues)
        .values({ name: input.name })
        .returning();
      return league;
    },

    async updateUserTeam(id, userTeamId) {
      log.debug({ id, userTeamId }, "updating league user team");
      const [league] = await deps.db
        .update(leagues)
        .set({ userTeamId, updatedAt: new Date() })
        .where(eq(leagues.id, id))
        .returning();
      return league;
    },

    async touchLastPlayed(id) {
      log.debug({ id }, "touching league last played");
      const now = new Date();
      const [league] = await deps.db
        .update(leagues)
        .set({ lastPlayedAt: now, updatedAt: now })
        .where(eq(leagues.id, id))
        .returning();
      return league;
    },

    async deleteById(id) {
      log.debug({ id }, "deleting league by id");
      await deps.db.delete(leagues).where(eq(leagues.id, id));
    },
  };
}
