import { assertEquals, assertExists } from "@std/assert";
import { Hono } from "hono";
import { sessionMiddleware } from "./session.ts";
import { createAuth } from "../features/auth/auth.ts";
import { createAuthRouter } from "../features/auth/auth.router.ts";
import { db } from "../db/connection.ts";
import type { AppEnv } from "../env.ts";

const auth = createAuth({ db });
const authRouter = createAuthRouter(auth);

function createTestApp() {
  const app = new Hono<AppEnv>()
    .use(sessionMiddleware(auth))
    .route("/api/auth", authRouter)
    .get("/api/me", (c) => {
      const user = c.get("user");
      const session = c.get("session");
      return c.json({ user, session });
    });
  return app;
}

Deno.test({
  name: "session middleware sets user and session to null when unauthenticated",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const app = createTestApp();
    const res = await app.request("/api/me");
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.user, null);
    assertEquals(body.session, null);
  },
});

Deno.test({
  name: "session middleware populates user and session when authenticated",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const app = createTestApp();
    const email = `session-test-${crypto.randomUUID()}@example.com`;

    const signUpRes = await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Session User",
        email,
        password: "password1234",
      }),
    });
    assertEquals(signUpRes.status, 200);

    // Extract the session cookie
    const setCookie = signUpRes.headers.get("set-cookie");
    const cookieHeader = setCookie
      ?.split(",")
      .map((c) => c.trim().split(";")[0])
      .join("; ") ?? "";

    const meRes = await app.request("/api/me", {
      headers: { cookie: cookieHeader },
    });
    assertEquals(meRes.status, 200);
    const body = await meRes.json();
    assertEquals(body.user.email, email);
    assertEquals(body.user.name, "Session User");
    assertExists(body.session);
  },
});
