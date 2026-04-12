import { Hono } from "hono";
import { serveStatic } from "hono/deno";
import { db } from "./db/connection.ts";
import { sql } from "drizzle-orm";
import { spaRouteGuard } from "./middleware/spa-fallback.ts";

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

// In production, serve the built client assets
if (Deno.env.get("DENO_ENV") === "production") {
  app.use("/*", serveStatic({ root: "../client/dist" }));
}

app.get("/*", spaRouteGuard());

if (Deno.env.get("DENO_ENV") === "production") {
  app.get("/*", serveStatic({ root: "../client/dist", path: "index.html" }));
}

if (import.meta.main) {
  const isProduction = Deno.env.get("DENO_ENV") === "production";

  Deno.serve({
    port: 3000,
    onListen: ({ hostname, port }) => {
      if (isProduction) {
        console.log(`Listening on http://${hostname}:${port}/`);
      } else {
        const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
        const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
        const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
        const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
        const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;

        const divider = dim("─".repeat(48));
        const apiUrl = `http://${hostname}:${port}/`;
        const appUrl = "http://localhost:5173/";

        console.log();
        console.log(divider);
        console.log(bold(yellow("  🏈  Zone Blitz — Dev Server")));
        console.log(divider);
        console.log();
        console.log(`  ${green("▸")} ${bold("App:")}        ${cyan(appUrl)}`);
        console.log(`  ${green("▸")} ${bold("API:")}        ${cyan(apiUrl)}`);
        console.log();
        console.log(divider);
        console.log();
      }
    },
  }, app.fetch);
}
