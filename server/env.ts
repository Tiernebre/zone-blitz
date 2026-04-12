import type { Env } from "hono";
import type pino from "pino";
import type { Session, User } from "better-auth";

export type AppEnv = Env & {
  Variables: {
    requestId: string;
    log: pino.Logger;
    user: User | null;
    session: Session | null;
  };
};
