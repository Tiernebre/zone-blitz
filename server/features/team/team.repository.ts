import type { TeamRepository } from "./team.repository.interface.ts";
import type pino from "pino";
import { eq } from "drizzle-orm";
import type { Database } from "../../db/connection.ts";
import { teams } from "./team.schema.ts";
import { cities } from "../cities/city.schema.ts";
import { states } from "../states/state.schema.ts";
import type { Team } from "@zone-blitz/shared";

const teamColumns = {
  id: teams.id,
  name: teams.name,
  cityId: teams.cityId,
  city: cities.name,
  state: states.code,
  abbreviation: teams.abbreviation,
  primaryColor: teams.primaryColor,
  secondaryColor: teams.secondaryColor,
  accentColor: teams.accentColor,
  conference: teams.conference,
  division: teams.division,
  createdAt: teams.createdAt,
  updatedAt: teams.updatedAt,
};

export function createTeamRepository(deps: {
  db: Database;
  log: pino.Logger;
}): TeamRepository {
  const log = deps.log.child({ module: "team.repository" });

  return {
    async getAll(): Promise<Team[]> {
      log.debug("fetching all teams");
      return await deps.db
        .select(teamColumns)
        .from(teams)
        .innerJoin(cities, eq(teams.cityId, cities.id))
        .innerJoin(states, eq(cities.stateId, states.id));
    },

    async getById(id): Promise<Team | undefined> {
      log.debug({ id }, "fetching team by id");
      const [team] = await deps.db
        .select(teamColumns)
        .from(teams)
        .innerJoin(cities, eq(teams.cityId, cities.id))
        .innerJoin(states, eq(cities.stateId, states.id))
        .where(eq(teams.id, id))
        .limit(1);
      return team;
    },
  };
}
