import { assertEquals, assertExists } from "@std/assert";
import { Hono } from "hono";
import { sessionMiddleware } from "./session.ts";
import type { Auth } from "../features/auth/mod.ts";
import type { AppEnv } from "../env.ts";

function createMockAuth(
  sessionData: { user: object; session: object } | null = null,
): Auth {
  return {
    api: {
      getSession: () => Promise.resolve(sessionData),
    },
  } as unknown as Auth;
}

function createTestApp(auth: Auth) {
  return new Hono<AppEnv>()
    .use(sessionMiddleware(auth))
    .get("/api/me", (c) => {
      const user = c.get("user");
      const session = c.get("session");
      return c.json({ user, session });
    });
}

Deno.test("session middleware", async (t) => {
  await t.step(
    "sets user and session to null when unauthenticated",
    async () => {
      const app = createTestApp(createMockAuth(null));
      const res = await app.request("/api/me");
      assertEquals(res.status, 200);
      const body = await res.json();
      assertEquals(body.user, null);
      assertEquals(body.session, null);
    },
  );

  await t.step(
    "populates user and session when authenticated",
    async () => {
      const mockUser = {
        id: "user-1",
        name: "Test User",
        email: "test@example.com",
      };
      const mockSession = {
        id: "session-1",
        userId: "user-1",
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      };

      const app = createTestApp(
        createMockAuth({ user: mockUser, session: mockSession }),
      );
      const res = await app.request("/api/me");
      assertEquals(res.status, 200);
      const body = await res.json();
      assertEquals(body.user.email, "test@example.com");
      assertEquals(body.user.name, "Test User");
      assertExists(body.session);
    },
  );
});
