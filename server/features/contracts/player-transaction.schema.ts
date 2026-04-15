import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { PLAYER_TRANSACTION_TYPES } from "@zone-blitz/shared";
import { players } from "../players/player.schema.ts";
import { teams } from "../team/team.schema.ts";

export const playerTransactionTypeEnum = pgEnum(
  "player_transaction_type",
  PLAYER_TRANSACTION_TYPES,
);

export const playerTransactions = pgTable("player_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  playerId: uuid("player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
  counterpartyTeamId: uuid("counterparty_team_id").references(() => teams.id, {
    onDelete: "set null",
  }),
  counterpartyPlayerId: uuid("counterparty_player_id").references(
    () => players.id,
    { onDelete: "set null" },
  ),
  type: playerTransactionTypeEnum("type").notNull(),
  seasonYear: integer("season_year").notNull(),
  occurredAt: timestamp("occurred_at").defaultNow().notNull(),
  detail: text("detail"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
