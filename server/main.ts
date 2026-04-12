import { Hono } from "hono";
import { db } from "./db/connection.ts";
import { sql } from "drizzle-orm";

const app = new Hono();

const GIT_SHA = Deno.env.get("GIT_SHA") ?? "unknown";

app.get("/api/health", async (c) => {
  try {
    await db.execute(sql`SELECT 1`);
    return c.json({ status: "ok", commit: GIT_SHA });
  } catch {
    return c.json({ status: "error", commit: GIT_SHA }, 500);
  }
});

Deno.serve({ port: 3000 }, app.fetch);
