import { eq } from "drizzle-orm";
import type { Franchise } from "@zone-blitz/shared";
import type { Database } from "../../db/connection.ts";
import { franchises } from "./franchise.schema.ts";
import { cities } from "../cities/city.schema.ts";
import { states } from "../states/state.schema.ts";
import type pino from "pino";

const franchiseColumns = {
  id: franchises.id,
  name: franchises.name,
  cityId: franchises.cityId,
  city: cities.name,
  state: states.code,
  abbreviation: franchises.abbreviation,
  primaryColor: franchises.primaryColor,
  secondaryColor: franchises.secondaryColor,
  accentColor: franchises.accentColor,
  backstory: franchises.backstory,
  conference: franchises.conference,
  division: franchises.division,
  marketTier: franchises.marketTier,
  createdAt: franchises.createdAt,
  updatedAt: franchises.updatedAt,
};

export interface FranchiseRepository {
  getAll(): Promise<Franchise[]>;
  getById(id: string): Promise<Franchise | undefined>;
}

export function createFranchiseRepository(deps: {
  db: Database;
  log: pino.Logger;
}): FranchiseRepository {
  const log = deps.log.child({ module: "franchise.repository" });

  return {
    async getAll() {
      log.debug("fetching all franchises");
      return await deps.db
        .select(franchiseColumns)
        .from(franchises)
        .innerJoin(cities, eq(franchises.cityId, cities.id))
        .innerJoin(states, eq(cities.stateId, states.id));
    },

    async getById(id) {
      log.debug({ id }, "fetching franchise by id");
      const [franchise] = await deps.db
        .select(franchiseColumns)
        .from(franchises)
        .innerJoin(cities, eq(franchises.cityId, cities.id))
        .innerJoin(states, eq(cities.stateId, states.id))
        .where(eq(franchises.id, id))
        .limit(1);
      return franchise;
    },
  };
}
