import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { cities } from "../cities/city.schema.ts";

export const franchises = pgTable("franchises", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  cityId: uuid("city_id")
    .notNull()
    .references(() => cities.id, { onDelete: "restrict" }),
  abbreviation: text("abbreviation").notNull().unique(),
  primaryColor: text("primary_color").notNull(),
  secondaryColor: text("secondary_color").notNull(),
  accentColor: text("accent_color").notNull(),
  backstory: text("backstory").notNull().default(""),
  conference: text("conference").notNull(),
  division: text("division").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
