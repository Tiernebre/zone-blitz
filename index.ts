import { start } from "./src/server.ts";
import postgres from "postgres";

start();

const sql = postgres({
  host: "db",
  port: 5432,
  user: "postgres",
  password: "example",
  database: "postgres",
});

const result = await sql`SELECT 1`;
console.log({ result });
