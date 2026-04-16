import {
  type AnyPgColumn,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { cities } from "../cities/city.schema.ts";
import { leagues } from "../league/league.schema.ts";
import { franchises, marketTierEnum } from "../franchise/franchise.schema.ts";

export const teams = pgTable(
  "teams",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    leagueId: uuid("league_id")
      .notNull()
      .references((): AnyPgColumn => leagues.id, { onDelete: "cascade" }),
    franchiseId: uuid("franchise_id")
      .notNull()
      .references((): AnyPgColumn => franchises.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    cityId: uuid("city_id")
      .notNull()
      .references(() => cities.id, { onDelete: "restrict" }),
    abbreviation: text("abbreviation").notNull(),
    primaryColor: text("primary_color").notNull(),
    secondaryColor: text("secondary_color").notNull(),
    accentColor: text("accent_color").notNull(),
    backstory: text("backstory").notNull().default(""),
    conference: text("conference").notNull(),
    division: text("division").notNull(),
    marketTier: marketTierEnum("market_tier").notNull().default("medium"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [unique().on(table.leagueId, table.franchiseId)],
);
