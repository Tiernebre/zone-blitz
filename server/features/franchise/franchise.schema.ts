import { pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { leagues } from "../league/league.schema.ts";
import { teams } from "../team/team.schema.ts";

export const franchises = pgTable(
  "franchises",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    leagueId: uuid("league_id")
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [unique().on(table.leagueId, table.teamId)],
);
