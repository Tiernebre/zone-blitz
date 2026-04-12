import { assertEquals } from "@std/assert";
import { Hono } from "hono";
import { authGuard } from "./auth-guard.ts";
import type { AppEnv } from "../env.ts";

function createTestApp() {
  const app = new Hono<AppEnv>();

  // Simulate session middleware setting user/session
  app.use((c, next) => {
    if (!c.get("user")) {
      c.set("user", null);
      c.set("session", null);
    }
    return next();
  });

  app.use("/api/protected/*", authGuard());
  app.get("/api/protected/resource", (c) => c.json({ data: "secret" }));
  app.get("/api/public", (c) => c.json({ data: "open" }));

  return app;
}

Deno.test("auth guard", async (t) => {
  await t.step("returns 401 when user is null", async () => {
    const app = createTestApp();
    const res = await app.request("/api/protected/resource");
    assertEquals(res.status, 401);
    const body = await res.json();
    assertEquals(body.error, "UNAUTHORIZED");
  });

  await t.step("allows request when user is present", async () => {
    const appWithAuth = new Hono<AppEnv>();
    appWithAuth.use((c, next) => {
      c.set("user", {
        id: "user-1",
        name: "Test",
        email: "test@test.com",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      c.set("session", {
        id: "session-1",
        userId: "user-1",
        token: "token-1",
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return next();
    });
    appWithAuth.use("/api/protected/*", authGuard());
    appWithAuth.get(
      "/api/protected/resource",
      (c) => c.json({ data: "secret" }),
    );

    const res = await appWithAuth.request("/api/protected/resource");
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.data, "secret");
  });

  await t.step("does not affect routes outside its path", async () => {
    const app = createTestApp();
    const res = await app.request("/api/public");
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.data, "open");
  });
});
