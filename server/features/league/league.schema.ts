import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const leagues = pgTable("leagues", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  numberOfTeams: integer("number_of_teams").notNull().default(32),
  seasonLength: integer("season_length").notNull().default(17),
  salaryCap: integer("salary_cap").notNull().default(255_000_000),
  capFloorPercent: integer("cap_floor_percent").notNull().default(89),
  capGrowthRate: integer("cap_growth_rate").notNull().default(5),
  rosterSize: integer("roster_size").notNull().default(53),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
