import { eq } from "drizzle-orm";
import type { Franchise } from "@zone-blitz/shared";
import type { Database, Executor } from "../../db/connection.ts";
import { franchises } from "./franchise.schema.ts";
import type pino from "pino";

export interface FranchiseRepository {
  createMany(
    rows: { leagueId: string; teamId: string }[],
    tx?: Executor,
  ): Promise<Franchise[]>;

  getByLeagueId(leagueId: string, tx?: Executor): Promise<Franchise[]>;
}

export function createFranchiseRepository(deps: {
  db: Database;
  log: pino.Logger;
}): FranchiseRepository {
  const log = deps.log.child({ module: "franchise.repository" });

  return {
    async createMany(rows, tx) {
      log.debug({ count: rows.length }, "creating franchises");
      return await (tx ?? deps.db)
        .insert(franchises)
        .values(rows)
        .returning();
    },

    async getByLeagueId(leagueId, tx) {
      log.debug({ leagueId }, "fetching franchises for league");
      return await (tx ?? deps.db)
        .select()
        .from(franchises)
        .where(eq(franchises.leagueId, leagueId));
    },
  };
}
