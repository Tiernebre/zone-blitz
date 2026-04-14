import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import pino from "pino";
import { colleges, teams } from "./schema.ts";
import { DEFAULT_TEAMS } from "../features/team/default-teams.ts";
import { DEFAULT_COLLEGES } from "../features/colleges/default-colleges.ts";

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

log.info("Seeding default colleges...");

await db
  .insert(colleges)
  .values(DEFAULT_COLLEGES)
  .onConflictDoNothing({ target: colleges.name });

log.info({ count: DEFAULT_COLLEGES.length }, "Default colleges seeded.");

await client.end();
