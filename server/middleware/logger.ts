import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../env.ts";

const MAX_REASON_LENGTH = 2048;

async function readReason(res: Response): Promise<unknown> {
  try {
    const text = await res.clone().text();
    if (!text) return undefined;
    const truncated = text.length > MAX_REASON_LENGTH
      ? `${text.slice(0, MAX_REASON_LENGTH)}…`
      : text;
    try {
      return JSON.parse(truncated);
    } catch {
      return truncated;
    }
  } catch {
    return undefined;
  }
}

export function loggerMiddleware(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const start = Date.now();
    await next();

    const log = c.get("log");
    const status = c.res.status;
    const data: Record<string, unknown> = {
      method: c.req.method,
      path: c.req.path,
      status,
      responseTime: Date.now() - start,
    };
    const msg = `${c.req.method} ${c.req.path}`;

    if (status >= 400) {
      const reason = await readReason(c.res);
      if (reason !== undefined) data.reason = reason;
    }

    if (status >= 500) log.error(data, msg);
    else if (status >= 400) log.warn(data, msg);
    else log.info(data, msg);
  };
}
