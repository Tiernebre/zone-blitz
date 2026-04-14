import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const states = pgTable("states", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull().unique(),
  region: text("region").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
