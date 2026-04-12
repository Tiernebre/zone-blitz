import postgres from "postgres";

const databaseUrl = Deno.env.get("DATABASE_URL_E2E") ??
  "postgres://zone_blitz:zone_blitz@localhost:5432/zone_blitz_e2e";

const sql = postgres(databaseUrl, { max: 1 });

export async function resetDatabase(): Promise<void> {
  await sql`TRUNCATE health_checks CASCADE`;
}

export async function closeDatabase(): Promise<void> {
  await sql.end();
}
