import postgres from "postgres";

const adminUrl = "postgres://zone_blitz:zone_blitz@localhost:5432/postgres";
const e2eDbName = "zone_blitz_e2e";

// Create the E2E database if it doesn't exist
const admin = postgres(adminUrl, { max: 1 });
const existing = await admin`
  SELECT 1 FROM pg_database WHERE datname = ${e2eDbName}
`;
if (existing.length === 0) {
  await admin.unsafe(`CREATE DATABASE ${e2eDbName} OWNER zone_blitz`);
  console.log(`Created database: ${e2eDbName}`);
} else {
  console.log(`Database already exists: ${e2eDbName}`);
}
await admin.end();

// Run migrations against the E2E database
const migrateUrl =
  `postgres://zone_blitz:zone_blitz@localhost:5432/${e2eDbName}`;
const migrate = new Deno.Command("deno", {
  args: [
    "run",
    "--allow-net",
    "--allow-env",
    "--allow-read",
    "--allow-sys",
    "server/db/migrate.ts",
  ],
  env: { DATABASE_URL: migrateUrl },
  stdout: "inherit",
  stderr: "inherit",
});
const { code } = await migrate.output();
if (code !== 0) {
  console.error("Migration failed");
  Deno.exit(code);
}
