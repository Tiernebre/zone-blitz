import { Hono } from "hono";
import { serveStatic } from "hono/deno";
import { db } from "./db/connection.ts";
import { DomainError } from "@zone-blitz/shared";
import { logger } from "./logger.ts";
import { requestContextMiddleware } from "./middleware/request-context.ts";
import { loggerMiddleware } from "./middleware/logger.ts";
import { spaRouteGuard } from "./middleware/spa-fallback.ts";
import { sessionMiddleware } from "./middleware/session.ts";
import { authGuard } from "./middleware/auth-guard.ts";
import { createFeatureRouters } from "./features/mod.ts";
import type { AppEnv } from "./env.ts";

const GIT_SHA = Deno.env.get("GIT_SHA") ?? "unknown";
const isProduction = Deno.env.get("DENO_ENV") === "production";
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";

const features = createFeatureRouters({
  db,
  commit: GIT_SHA,
  log: logger,
  googleClientId: GOOGLE_CLIENT_ID,
  googleClientSecret: GOOGLE_CLIENT_SECRET,
});

const app = new Hono<AppEnv>()
  .use(requestContextMiddleware(logger))
  .use(loggerMiddleware())
  .use(sessionMiddleware(features.auth))
  .route("/api/auth", features.authRouter)
  .route("/api/health", features.healthRouter)
  .use("/api/leagues/*", authGuard())
  .use("/api/leagues", authGuard())
  .route("/api/leagues", features.leagueRouter)
  .use("/api/users/*", authGuard())
  .use("/api/users", authGuard())
  .route("/api/users", features.userRouter)
  .use("/api/teams/*", authGuard())
  .use("/api/teams", authGuard())
  .route("/api/teams", features.teamRouter)
  .use("/api/coaches/*", authGuard())
  .use("/api/coaches", authGuard())
  .route("/api/coaches", features.coachesRouter)
  .use("/api/scouts/*", authGuard())
  .use("/api/scouts", authGuard())
  .route("/api/scouts", features.scoutsRouter)
  .use("/api/roster/*", authGuard())
  .use("/api/roster", authGuard())
  .route("/api/roster", features.rosterRouter)
  .use("/api/players/*", authGuard())
  .use("/api/players", authGuard())
  .route("/api/players", features.playersRouter);

// Domain error handler
app.onError((err, c) => {
  if (err instanceof DomainError) {
    return c.json({ error: err.code, message: err.message }, 400);
  }
  const log = c.get("log");
  log.error({ err }, "unhandled error");
  return c.json({ error: "INTERNAL" }, 500);
});

// Production static asset serving
if (isProduction) {
  app.use("/*", serveStatic({ root: "../client/dist" }));
}
app.get("/*", spaRouteGuard());
if (isProduction) {
  app.get("/*", serveStatic({ root: "../client/dist", path: "index.html" }));
}

export type AppType = typeof app;

if (import.meta.main) {
  Deno.serve({
    port: 3000,
    onListen: ({ hostname, port }) => {
      if (isProduction) {
        logger.info({ hostname, port }, "server started");
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
