import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { CONTRACT_TYPES } from "@zone-blitz/shared";
import { players } from "../players/player.schema.ts";
import { teams } from "../team/team.schema.ts";

export const contractTypeEnum = pgEnum("contract_type", CONTRACT_TYPES);

export const contractTagTypeEnum = pgEnum("contract_tag_type", [
  "franchise",
  "transition",
]);

export const contractGuaranteeTypeEnum = pgEnum("contract_guarantee_type", [
  "full",
  "injury",
  "none",
]);

export const contractBonusSourceEnum = pgEnum("contract_bonus_source", [
  "signing",
  "restructure",
  "option",
]);

export const contracts = pgTable("contracts", {
  id: uuid("id").defaultRandom().primaryKey(),
  playerId: uuid("player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  signedYear: integer("signed_year").notNull(),
  totalYears: integer("total_years").notNull(),
  realYears: integer("real_years").notNull(),
  signingBonus: integer("signing_bonus").notNull().default(0),
  isRookieDeal: boolean("is_rookie_deal").notNull().default(false),
  rookieDraftPick: integer("rookie_draft_pick"),
  tagType: contractTagTypeEnum("tag_type"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const contractYears = pgTable("contract_years", {
  id: uuid("id").defaultRandom().primaryKey(),
  contractId: uuid("contract_id")
    .notNull()
    .references(() => contracts.id, { onDelete: "cascade" }),
  leagueYear: integer("league_year").notNull(),
  base: integer("base").notNull().default(0),
  rosterBonus: integer("roster_bonus").notNull().default(0),
  workoutBonus: integer("workout_bonus").notNull().default(0),
  perGameRosterBonus: integer("per_game_roster_bonus").notNull().default(0),
  guaranteeType: contractGuaranteeTypeEnum("guarantee_type")
    .notNull()
    .default("none"),
  isVoid: boolean("is_void").notNull().default(false),
});

export const contractBonusProrations = pgTable("contract_bonus_prorations", {
  id: uuid("id").defaultRandom().primaryKey(),
  contractId: uuid("contract_id")
    .notNull()
    .references(() => contracts.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  firstYear: integer("first_year").notNull(),
  years: integer("years").notNull(),
  source: contractBonusSourceEnum("source").notNull(),
});

export const contractOptionBonuses = pgTable("contract_option_bonuses", {
  id: uuid("id").defaultRandom().primaryKey(),
  contractId: uuid("contract_id")
    .notNull()
    .references(() => contracts.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  exerciseYear: integer("exercise_year").notNull(),
  prorationYears: integer("proration_years").notNull(),
  exercisedAt: timestamp("exercised_at"),
});
