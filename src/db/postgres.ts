import postgres from "postgres";

export const sql = postgres({
  host: "db",
  port: 5432,
  user: "postgres",
  password: "example",
  database: "postgres",
});
