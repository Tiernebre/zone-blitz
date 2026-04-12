import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const healthChecks = pgTable("health_checks", {
  id: serial("id").primaryKey(),
  status: text("status").notNull(),
  checkedAt: timestamp("checked_at").defaultNow().notNull(),
});

// Feature schemas
export { leagues } from "../features/league/league.schema.ts";
export {
  accounts,
  sessions,
  users,
  verifications,
} from "../features/auth/auth.schema.ts";
