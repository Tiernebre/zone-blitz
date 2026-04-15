import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { leagues } from "../league/league.schema.ts";
import { teams } from "../team/team.schema.ts";
import { colleges } from "../colleges/college.schema.ts";

export const coachRoleEnum = pgEnum("coach_role", [
  "HC",
  "OC",
  "DC",
  "STC",
  "QB",
  "RB",
  "WR",
  "TE",
  "OL",
  "DL",
  "LB",
  "DB",
  "ST_ASSISTANT",
]);

export const coachPlayCallerEnum = pgEnum("coach_play_caller", [
  "offense",
  "defense",
  "ceo",
]);

export const coachSpecialtyEnum = pgEnum("coach_specialty", [
  "offense",
  "defense",
  "special_teams",
  "quarterbacks",
  "running_backs",
  "wide_receivers",
  "tight_ends",
  "offensive_line",
  "defensive_line",
  "linebackers",
  "defensive_backs",
  "ceo",
]);

export const coaches = pgTable("coaches", {
  id: uuid("id").defaultRandom().primaryKey(),
  leagueId: uuid("league_id")
    .notNull()
    .references(() => leagues.id, { onDelete: "cascade" }),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  role: coachRoleEnum("role").notNull(),
  reportsToId: uuid("reports_to_id").references(
    (): AnyPgColumn => coaches.id,
    { onDelete: "set null" },
  ),
  playCaller: coachPlayCallerEnum("play_caller"),
  age: integer("age").notNull(),
  hiredAt: timestamp("hired_at").notNull(),
  contractYears: integer("contract_years").notNull(),
  contractSalary: integer("contract_salary").notNull(),
  contractBuyout: integer("contract_buyout").notNull(),
  collegeId: uuid("college_id").references(() => colleges.id, {
    onDelete: "set null",
  }),
  specialty: coachSpecialtyEnum("specialty"),
  isVacancy: boolean("is_vacancy").notNull().default(false),
  mentorCoachId: uuid("mentor_coach_id").references(
    (): AnyPgColumn => coaches.id,
    { onDelete: "set null" },
  ),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("coaches_league_name_unique").on(
    table.leagueId,
    table.firstName,
    table.lastName,
  ),
]);
