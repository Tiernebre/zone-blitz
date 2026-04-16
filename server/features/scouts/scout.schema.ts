import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { leagues } from "../league/league.schema.ts";
import { teams } from "../team/team.schema.ts";

export const scoutRoleEnum = pgEnum("scout_role", [
  "DIRECTOR",
  "NATIONAL_CROSS_CHECKER",
  "AREA_SCOUT",
]);

export const scouts = pgTable("scouts", {
  id: uuid("id").defaultRandom().primaryKey(),
  leagueId: uuid("league_id")
    .notNull()
    .references(() => leagues.id, { onDelete: "cascade" }),
  teamId: uuid("team_id")
    .references(() => teams.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  role: scoutRoleEnum("role").notNull().default("AREA_SCOUT"),
  reportsToId: uuid("reports_to_id").references(
    (): AnyPgColumn => scouts.id,
    { onDelete: "set null" },
  ),
  coverage: text("coverage"),
  age: integer("age").notNull().default(40),
  yearsExperience: integer("years_experience").notNull().default(0),
  hiredAt: timestamp("hired_at").notNull().defaultNow(),
  contractYears: integer("contract_years").notNull().default(1),
  contractSalary: integer("contract_salary").notNull().default(0),
  contractBuyout: integer("contract_buyout").notNull().default(0),
  workCapacity: integer("work_capacity").notNull().default(100),
  isVacancy: boolean("is_vacancy").notNull().default(false),
  marketTierPref: integer("market_tier_pref"),
  philosophyFitPref: integer("philosophy_fit_pref"),
  staffFitPref: integer("staff_fit_pref"),
  compensationPref: integer("compensation_pref"),
  minimumThreshold: integer("minimum_threshold"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
