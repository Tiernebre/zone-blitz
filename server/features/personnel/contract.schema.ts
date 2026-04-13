import { integer, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { players } from "./personnel.schema.ts";
import { teams } from "../team/team.schema.ts";

export const contracts = pgTable("contracts", {
  id: uuid("id").defaultRandom().primaryKey(),
  playerId: uuid("player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  totalYears: integer("total_years").notNull(),
  currentYear: integer("current_year").notNull().default(1),
  totalSalary: integer("total_salary").notNull(),
  annualSalary: integer("annual_salary").notNull(),
  guaranteedMoney: integer("guaranteed_money").notNull().default(0),
  signingBonus: integer("signing_bonus").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
