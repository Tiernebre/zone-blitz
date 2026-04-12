import type { MiddlewareHandler } from "hono";
import type pino from "pino";
import type { AppEnv } from "../env.ts";

export function requestContextMiddleware(
  log: pino.Logger,
): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const requestId = c.req.header("X-Request-Id") ?? crypto.randomUUID();
    const requestLog = log.child({ requestId });

    c.set("requestId", requestId);
    c.set("log", requestLog);

    await next();
  };
}
