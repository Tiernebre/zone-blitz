import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const healthChecks = pgTable("health_checks", {
  id: serial("id").primaryKey(),
  status: text("status").notNull(),
  checkedAt: timestamp("checked_at").defaultNow().notNull(),
});

// Feature schemas
export { leagues } from "../features/league/league.schema.ts";
export { teams } from "../features/team/team.schema.ts";
export { seasonPhaseEnum, seasons } from "../features/season/season.schema.ts";
export {
  coaches,
  frontOfficeStaff,
  scouts,
} from "../features/personnel/personnel.schema.ts";
export { draftProspects, players } from "../features/players/player.schema.ts";
export { contracts } from "../features/players/contract.schema.ts";
export { games } from "../features/schedule/game.schema.ts";
export {
  accounts,
  sessions,
  users,
  verifications,
} from "../features/auth/auth.schema.ts";
