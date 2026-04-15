import type { SeasonRepository } from "./season.repository.interface.ts";
import type pino from "pino";
import { eq } from "drizzle-orm";
import type { Database } from "../../db/connection.ts";
import { seasons } from "./season.schema.ts";

export function createSeasonRepository(deps: {
  db: Database;
  log: pino.Logger;
}): SeasonRepository {
  const log = deps.log.child({ module: "season.repository" });

  return {
    async getByLeagueId(leagueId) {
      log.debug({ leagueId }, "fetching seasons by league id");
      return await deps.db
        .select()
        .from(seasons)
        .where(eq(seasons.leagueId, leagueId));
    },

    async getById(id) {
      log.debug({ id }, "fetching season by id");
      const [season] = await deps.db
        .select()
        .from(seasons)
        .where(eq(seasons.id, id))
        .limit(1);
      return season;
    },

    async create(input, tx) {
      log.debug({ leagueId: input.leagueId }, "creating season");
      const [season] = await (tx ?? deps.db)
        .insert(seasons)
        .values({
          leagueId: input.leagueId,
          year: input.year,
          phase: input.phase,
          offseasonStage: input.offseasonStage,
          week: input.week,
        })
        .returning();
      return season;
    },
  };
}
