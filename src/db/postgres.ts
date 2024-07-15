import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

const url = Deno.env.get("DATABASE_URL");

if (!url) {
  console.error("Database URL was not provided.");
  Deno.exit(1);
}

export const sql = postgres(url, {
  onnotice: () => "",
});
