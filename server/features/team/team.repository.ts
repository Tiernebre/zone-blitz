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
  leagueId: teams.leagueId,
  franchiseId: teams.franchiseId,
  name: teams.name,
  cityId: teams.cityId,
  city: cities.name,
  state: states.code,
  abbreviation: teams.abbreviation,
  primaryColor: teams.primaryColor,
  secondaryColor: teams.secondaryColor,
  accentColor: teams.accentColor,
  backstory: teams.backstory,
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
    async createMany(rows, tx) {
      log.debug({ count: rows.length }, "creating teams");
      if (rows.length === 0) return [];
      const inserted = await (tx ?? deps.db)
        .insert(teams)
        .values(rows)
        .returning({ id: teams.id });
      const ids = inserted.map((r) => r.id);
      if (ids.length === 0) return [];
      const created = await (tx ?? deps.db)
        .select(teamColumns)
        .from(teams)
        .innerJoin(cities, eq(teams.cityId, cities.id))
        .innerJoin(states, eq(cities.stateId, states.id))
        .where(eq(teams.leagueId, rows[0].leagueId));
      return created.filter((t) => ids.includes(t.id));
    },

    async getByLeagueId(leagueId, tx): Promise<Team[]> {
      log.debug({ leagueId }, "fetching teams for league");
      return await (tx ?? deps.db)
        .select(teamColumns)
        .from(teams)
        .innerJoin(cities, eq(teams.cityId, cities.id))
        .innerJoin(states, eq(cities.stateId, states.id))
        .where(eq(teams.leagueId, leagueId));
    },

    async getById(id, tx): Promise<Team | undefined> {
      log.debug({ id }, "fetching team by id");
      const [team] = await (tx ?? deps.db)
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
