import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import pino from "pino";
import { teams } from "./schema.ts";
import { DEFAULT_TEAMS } from "../features/team/default-teams.ts";

const log = pino({
  transport: { target: "pino-pretty" },
});

const databaseUrl = Deno.env.get("DATABASE_URL");
if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required");
}

const client = postgres(databaseUrl, {
  max: 1,
  onnotice: () => {},
});
const db = drizzle(client);

log.info("Seeding default teams...");

await db
  .insert(teams)
  .values(DEFAULT_TEAMS)
  .onConflictDoNothing({ target: teams.abbreviation });

log.info({ count: DEFAULT_TEAMS.length }, "Default teams seeded.");

await client.end();
