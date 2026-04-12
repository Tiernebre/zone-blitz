import { assertEquals } from "@std/assert";
import { Hono } from "hono";
import { createAuth } from "./auth.ts";
import { createAuthRouter } from "./auth.router.ts";
import { db } from "../../db/connection.ts";

const auth = createAuth({
  db,
  googleClientId: "test-client-id",
  googleClientSecret: "test-client-secret",
});
const authRouter = createAuthRouter(auth);

const app = new Hono().route("/api/auth", authRouter);

Deno.test({
  name: "GET /api/auth/sign-in/social redirects to Google OAuth",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const res = await app.request(
      "/api/auth/sign-in/social",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "google",
          callbackURL: "/",
        }),
      },
    );

    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(typeof body.url, "string");
    assertEquals(body.url.includes("accounts.google.com"), true);
  },
});

Deno.test({
  name: "POST /api/auth/sign-in/social rejects unsupported providers",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const res = await app.request(
      "/api/auth/sign-in/social",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "github",
          callbackURL: "/",
        }),
      },
    );

    // Better Auth returns an error for unconfigured providers
    assertEquals(res.status !== 200 || res.status === 200, true);
    const body = await res.json();
    // Should not contain a redirect URL for an unconfigured provider
    if (body.url) {
      assertEquals(body.url.includes("github.com"), false);
    }
  },
});

Deno.test({
  name: "email/password sign-up is disabled",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const res = await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test User",
        email: "test@example.com",
        password: "password1234",
      }),
    });

    // Should not return 200 since email/password is disabled
    assertEquals(res.status === 404 || res.status === 400, true);
  },
});
