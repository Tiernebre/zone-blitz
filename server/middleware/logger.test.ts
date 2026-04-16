import { assertEquals } from "@std/assert";
import { Hono } from "hono";
import type pino from "pino";
import { loggerMiddleware } from "./logger.ts";
import type { AppEnv } from "../env.ts";

interface LogEntry {
  level: "debug" | "info" | "warn" | "error";
  data: Record<string, unknown>;
  msg: string;
}

function createCapturingLogger() {
  const entries: LogEntry[] = [];
  const make = (): pino.Logger => {
    const record =
      (level: LogEntry["level"]) =>
      (data: Record<string, unknown>, msg: string) => {
        entries.push({ level, data, msg });
      };
    return {
      child: () => make(),
      debug: record("debug"),
      info: record("info"),
      warn: record("warn"),
      error: record("error"),
    } as unknown as pino.Logger;
  };
  return { log: make(), entries };
}

function createTestApp(log: pino.Logger) {
  return new Hono<AppEnv>()
    .use((c, next) => {
      c.set("log", log);
      c.set("requestId", "test-request-id");
      return next();
    })
    .use(loggerMiddleware())
    .get("/ok", (c) => c.json({ data: "ok" }))
    .get(
      "/bad-json",
      (c) => c.json({ error: "VALIDATION", message: "Bad input" }, 400),
    )
    .get("/unauthorized", (c) => c.json({ error: "UNAUTHORIZED" }, 401))
    .get("/plain-text", (c) => c.text("Not Found", 404))
    .get("/boom", () => {
      throw new Error("boom");
    });
}

Deno.test("logger middleware", async (t) => {
  await t.step("logs 2xx as info without a reason field", async () => {
    const { log, entries } = createCapturingLogger();
    const app = createTestApp(log);

    const res = await app.request("/ok");
    assertEquals(res.status, 200);

    const entry = entries.at(-1);
    assertEquals(entry?.level, "info");
    assertEquals(entry?.data.status, 200);
    assertEquals("reason" in (entry?.data ?? {}), false);
  });

  await t.step(
    "logs 4xx JSON responses as warn with the parsed body as reason",
    async () => {
      const { log, entries } = createCapturingLogger();
      const app = createTestApp(log);

      const res = await app.request("/bad-json");
      assertEquals(res.status, 400);

      const entry = entries.at(-1);
      assertEquals(entry?.level, "warn");
      assertEquals(entry?.data.status, 400);
      assertEquals(entry?.data.reason, {
        error: "VALIDATION",
        message: "Bad input",
      });
    },
  );

  await t.step(
    "logs 401 UNAUTHORIZED with the reason body",
    async () => {
      const { log, entries } = createCapturingLogger();
      const app = createTestApp(log);

      const res = await app.request("/unauthorized");
      assertEquals(res.status, 401);

      const entry = entries.at(-1);
      assertEquals(entry?.level, "warn");
      assertEquals(entry?.data.reason, { error: "UNAUTHORIZED" });
    },
  );

  await t.step(
    "falls back to raw text when the 4xx body is not JSON",
    async () => {
      const { log, entries } = createCapturingLogger();
      const app = createTestApp(log);

      const res = await app.request("/plain-text");
      assertEquals(res.status, 404);

      const entry = entries.at(-1);
      assertEquals(entry?.level, "warn");
      assertEquals(entry?.data.reason, "Not Found");
    },
  );

  await t.step(
    "preserves the response body consumable by the caller",
    async () => {
      const { log } = createCapturingLogger();
      const app = createTestApp(log);

      const res = await app.request("/bad-json");
      const body = await res.json();
      assertEquals(body, { error: "VALIDATION", message: "Bad input" });
    },
  );
});
