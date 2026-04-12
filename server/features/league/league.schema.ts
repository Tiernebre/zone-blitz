import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const leagues = pgTable("leagues", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
