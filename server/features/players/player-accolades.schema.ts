import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { PLAYER_ACCOLADE_TYPES } from "@zone-blitz/shared";
import { players } from "./player.schema.ts";

export const playerAccoladeTypeEnum = pgEnum(
  "player_accolade_type",
  PLAYER_ACCOLADE_TYPES,
);

export const playerAccolades = pgTable("player_accolades", {
  id: uuid("id").defaultRandom().primaryKey(),
  playerId: uuid("player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  seasonYear: integer("season_year").notNull(),
  type: playerAccoladeTypeEnum("type").notNull(),
  detail: text("detail"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
