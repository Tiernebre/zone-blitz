import { Hono } from "hono";
import type { AppEnv } from "../../env.ts";
import type { Auth } from "./auth.ts";

export function createAuthRouter(auth: Auth) {
  const router = new Hono<AppEnv>();

  router.on(["POST", "GET"], "/*", (c) => {
    return auth.handler(c.req.raw);
  });

  return router;
}
