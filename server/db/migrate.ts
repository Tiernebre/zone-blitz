import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import pino from "pino";

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

await migrate(db, { migrationsFolder: "./db/migrations" });
await client.end();

log.info("Migrations complete.");
