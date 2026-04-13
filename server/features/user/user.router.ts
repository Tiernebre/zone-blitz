import { Hono } from "hono";
import type { UserService } from "@zone-blitz/shared";
import type { AppEnv } from "../../env.ts";

export function createUserRouter(userService: UserService) {
  return new Hono<AppEnv>()
    .delete("/me", async (c) => {
      const user = c.get("user");

      if (!user) {
        return c.json({ error: "UNAUTHORIZED" }, 401);
      }

      await userService.deleteById(user.id);
      return c.body(null, 204);
    });
}
