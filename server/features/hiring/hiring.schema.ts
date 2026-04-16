import {
  type AnyPgColumn,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { leagues } from "../league/league.schema.ts";
import { teams } from "../team/team.schema.ts";

// Polymorphic discriminator — a hiring row belongs to either a coach or a
// scout. The `staff_id` column has no DB-level FK since it may reference
// either `coaches.id` or `scouts.id`; the `staff_type` value decides which.
export const staffTypeEnum = pgEnum("staff_type", ["coach", "scout"]);

export const hiringInterestStatusEnum = pgEnum(
  "hiring_interest_status",
  ["active", "withdrawn"],
);

export const hiringInterviewStatusEnum = pgEnum(
  "hiring_interview_status",
  ["requested", "accepted", "declined", "completed"],
);

export const hiringOfferStatusEnum = pgEnum(
  "hiring_offer_status",
  ["pending", "accepted", "rejected", "expired"],
);

export const hiringInterests = pgTable("hiring_interests", {
  id: uuid("id").defaultRandom().primaryKey(),
  leagueId: uuid("league_id")
    .notNull()
    .references(() => leagues.id, { onDelete: "cascade" }),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  staffType: staffTypeEnum("staff_type").notNull(),
  staffId: uuid("staff_id").notNull(),
  stepSlug: text("step_slug").notNull(),
  status: hiringInterestStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const hiringInterviews = pgTable("hiring_interviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  leagueId: uuid("league_id")
    .notNull()
    .references(() => leagues.id, { onDelete: "cascade" }),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  staffType: staffTypeEnum("staff_type").notNull(),
  staffId: uuid("staff_id").notNull(),
  stepSlug: text("step_slug").notNull(),
  status: hiringInterviewStatusEnum("status").notNull().default("requested"),
  philosophyReveal: jsonb("philosophy_reveal"),
  staffFitReveal: jsonb("staff_fit_reveal"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const hiringOffers = pgTable("hiring_offers", {
  id: uuid("id").defaultRandom().primaryKey(),
  leagueId: uuid("league_id")
    .notNull()
    .references(() => leagues.id, { onDelete: "cascade" }),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  staffType: staffTypeEnum("staff_type").notNull(),
  staffId: uuid("staff_id").notNull(),
  stepSlug: text("step_slug").notNull(),
  status: hiringOfferStatusEnum("status").notNull().default("pending"),
  salary: integer("salary").notNull(),
  contractYears: integer("contract_years").notNull(),
  // ADR 0032: buyout multiplier between 0.5 and 1.0 governs firing cost
  // (`salary × remaining years × multiplier`). Stored as numeric(3,2) to
  // keep the two-decimal granularity plus the 1.00 ceiling.
  buyoutMultiplier: numeric("buyout_multiplier", { precision: 3, scale: 2 })
    .notNull(),
  incentives: jsonb("incentives").notNull().default([]),
  preferenceScore: integer("preference_score"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const hiringDecisions = pgTable("hiring_decisions", {
  id: uuid("id").defaultRandom().primaryKey(),
  leagueId: uuid("league_id")
    .notNull()
    .references(() => leagues.id, { onDelete: "cascade" }),
  staffType: staffTypeEnum("staff_type").notNull(),
  staffId: uuid("staff_id").notNull(),
  chosenOfferId: uuid("chosen_offer_id").references(
    (): AnyPgColumn => hiringOffers.id,
    { onDelete: "set null" },
  ),
  wave: integer("wave").notNull(),
  decidedAt: timestamp("decided_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
