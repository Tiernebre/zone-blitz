import type { LeagueRepository } from "./league.repository.interface.ts";
import type pino from "pino";
import { desc, eq, inArray, sql } from "drizzle-orm";
import type { LeagueListItem } from "@zone-blitz/shared";
import type { Database } from "../../db/connection.ts";
import { leagues } from "./league.schema.ts";
import { seasons } from "../season/season.schema.ts";
import { teams } from "../team/team.schema.ts";
import { cities } from "../cities/city.schema.ts";

export function createLeagueRepository(deps: {
  db: Database;
  log: pino.Logger;
}): LeagueRepository {
  const log = deps.log.child({ module: "league.repository" });

  return {
    async listWithSummary() {
      log.debug("fetching leagues with summary");
      const leagueRows = await deps.db
        .select({
          league: leagues,
          userTeamId: teams.id,
          userTeamName: teams.name,
          userTeamCity: cities.name,
          userTeamAbbreviation: teams.abbreviation,
          userTeamPrimaryColor: teams.primaryColor,
        })
        .from(leagues)
        .leftJoin(teams, eq(teams.id, leagues.userTeamId))
        .leftJoin(cities, eq(cities.id, teams.cityId))
        .orderBy(
          sql`${leagues.lastPlayedAt} desc nulls last`,
          desc(leagues.createdAt),
        );

      if (leagueRows.length === 0) return [];

      const leagueIds = leagueRows.map((r) => r.league.id);
      const seasonRows = await deps.db
        .select()
        .from(seasons)
        .where(inArray(seasons.leagueId, leagueIds))
        .orderBy(seasons.leagueId, desc(seasons.year));

      // seasonRows are ordered by (leagueId, year desc), so the first
      // row seen for each league is its latest season.
      const latestByLeague = new Map<string, typeof seasonRows[number]>();
      for (const s of seasonRows) {
        if (!latestByLeague.has(s.leagueId)) latestByLeague.set(s.leagueId, s);
      }

      return leagueRows.map((row): LeagueListItem => {
        const current = latestByLeague.get(row.league.id);
        return {
          ...row.league,
          currentSeason: current
            ? {
              year: current.year,
              phase: current.phase,
              offseasonStage: current.offseasonStage,
              week: current.week,
            }
            : null,
          userTeam: row.userTeamId
            ? {
              id: row.userTeamId,
              name: row.userTeamName!,
              city: row.userTeamCity!,
              abbreviation: row.userTeamAbbreviation!,
              primaryColor: row.userTeamPrimaryColor!,
            }
            : null,
        };
      });
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
        .values({
          name: input.name,
        })
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
