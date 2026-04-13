import { assertEquals } from "@std/assert";
import { Hono } from "hono";
import { createUserRouter } from "./user.router.ts";
import type { UserService } from "@zone-blitz/shared";
import type { AppEnv } from "../../env.ts";

function createMockUserService(
  overrides: Partial<UserService> = {},
): UserService {
  return {
    deleteById: () => Promise.resolve(),
    ...overrides,
  };
}

function createAppWithUser(
  userService: UserService,
  user: { id: string; name: string } | null = { id: "user-1", name: "Test" },
) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("user", user as AppEnv["Variables"]["user"]);
    c.set("session", null);
    await next();
  });
  app.route("/", createUserRouter(userService));
  return app;
}

Deno.test("user.router", async (t) => {
  await t.step(
    "DELETE /me deletes the current user and returns 204",
    async () => {
      let deletedId: string | undefined;
      const service = createMockUserService({
        deleteById: (id) => {
          deletedId = id;
          return Promise.resolve();
        },
      });
      const app = createAppWithUser(service);

      const res = await app.request("/me", { method: "DELETE" });
      assertEquals(res.status, 204);
      assertEquals(deletedId, "user-1");
    },
  );

  await t.step("DELETE /me returns 401 when no user in context", async () => {
    const service = createMockUserService();
    const app = createAppWithUser(service, null);

    const res = await app.request("/me", { method: "DELETE" });
    assertEquals(res.status, 401);
  });
});
