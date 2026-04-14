import { pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { states } from "../states/state.schema.ts";

export const cities = pgTable(
  "cities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    stateId: uuid("state_id")
      .notNull()
      .references(() => states.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (
    table,
  ) => [unique("cities_name_state_id_unique").on(table.name, table.stateId)],
);
