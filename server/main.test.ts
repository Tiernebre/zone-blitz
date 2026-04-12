import { assertEquals } from "@std/assert";
import { Hono } from "hono";

Deno.test("GET /api/health returns ok with commit", async () => {
  const app = new Hono();

  app.get("/api/health", (c) => {
    return c.json({ status: "ok", commit: "test-sha" });
  });

  const res = await app.request("/api/health");
  assertEquals(res.status, 200);

  const body = await res.json();
  assertEquals(body.status, "ok");
  assertEquals(body.commit, "test-sha");
});
