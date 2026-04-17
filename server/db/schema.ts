import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const healthChecks = pgTable("health_checks", {
  id: serial("id").primaryKey(),
  status: text("status").notNull(),
  checkedAt: timestamp("checked_at").defaultNow().notNull(),
});

// Feature schemas
export { states } from "../features/states/state.schema.ts";
export { cities } from "../features/cities/city.schema.ts";
export { colleges } from "../features/colleges/college.schema.ts";
export {
  accounts,
  sessions,
  users,
  verifications,
} from "../features/auth/auth.schema.ts";
