import { assertEquals, assertExists } from "@std/assert";
import { Hono } from "hono";
import { createAuth } from "./auth.ts";
import { createAuthRouter } from "./auth.router.ts";
import { db } from "../../db/connection.ts";

const auth = createAuth({ db });
const authRouter = createAuthRouter(auth);

const app = new Hono().route("/api/auth", authRouter);

Deno.test({
  name: "POST /api/auth/sign-up/email creates a new user",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const res = await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test User",
        email: `test-${crypto.randomUUID()}@example.com`,
        password: "password1234",
      }),
    });

    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.user.name, "Test User");
    assertExists(body.user.id);
  },
});

Deno.test({
  name: "POST /api/auth/sign-in/email authenticates an existing user",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const email = `signin-${crypto.randomUUID()}@example.com`;

    await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Sign In User",
        email,
        password: "password1234",
      }),
    });

    const res = await app.request("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "password1234" }),
    });

    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.user.email, email);
    assertExists(body.user.id);
  },
});

Deno.test({
  name: "POST /api/auth/sign-in/email rejects invalid credentials",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const res = await app.request("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "nonexistent@example.com",
        password: "wrongpassword",
      }),
    });

    assertEquals(res.status, 401);
  },
});
