import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { teams } from "../team/team.schema.ts";

export const leagues = pgTable("leagues", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  userTeamId: uuid("user_team_id").references(() => teams.id, {
    onDelete: "set null",
  }),
  salaryCap: integer("salary_cap").notNull().default(255_000_000),
  capFloorPercent: integer("cap_floor_percent").notNull().default(89),
  capGrowthRate: integer("cap_growth_rate").notNull().default(5),
  rosterSize: integer("roster_size").notNull().default(53),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
