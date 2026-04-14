import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const colleges = pgTable("colleges", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  shortName: text("short_name").notNull(),
  nickname: text("nickname").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  conference: text("conference").notNull(),
  subdivision: text("subdivision").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
