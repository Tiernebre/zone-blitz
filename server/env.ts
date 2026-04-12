import type { Env } from "hono";
import type pino from "pino";

export type AppEnv = Env & {
  Variables: {
    requestId: string;
    log: pino.Logger;
  };
};
