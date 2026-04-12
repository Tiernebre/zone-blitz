import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../env.ts";
import type { Auth } from "../features/auth/mod.ts";

export function sessionMiddleware(auth: Auth) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (session) {
      c.set("user", session.user);
      c.set("session", session.session);
    } else {
      c.set("user", null);
      c.set("session", null);
    }

    return next();
  });
}
