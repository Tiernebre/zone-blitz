import { integer, pgEnum, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { CONTRACT_TERMINATION_REASONS } from "@zone-blitz/shared";
import { players } from "./player.schema.ts";
import { teams } from "../team/team.schema.ts";

export const contractTerminationReasonEnum = pgEnum(
  "contract_termination_reason",
  CONTRACT_TERMINATION_REASONS,
);

export const contractHistory = pgTable("contract_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  playerId: uuid("player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  signedInYear: integer("signed_in_year").notNull(),
  totalYears: integer("total_years").notNull(),
  totalSalary: integer("total_salary").notNull(),
  guaranteedMoney: integer("guaranteed_money").notNull().default(0),
  terminationReason: contractTerminationReasonEnum("termination_reason")
    .notNull()
    .default("active"),
  endedInYear: integer("ended_in_year"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
