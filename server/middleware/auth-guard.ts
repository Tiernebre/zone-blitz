import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../env.ts";

export function authGuard() {
  return createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get("user");

    if (!user) {
      return c.json({ error: "UNAUTHORIZED" }, 401);
    }

    await next();
  });
}
