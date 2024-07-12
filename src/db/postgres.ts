import postgres from "postgres";

const url = Deno.env.get("DATABASE_URL");

if (!url) {
  console.error("Database URL was not provided.");
  Deno.exit(1);
}

export const sql = postgres(Deno.env.get("DATABASE_URL") as string);
