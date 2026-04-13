import type { HealthService } from "./health.service.interface.ts";
import type pino from "pino";

export function createHealthService(deps: {
  ping: () => Promise<void>;
  commit: string;
  log: pino.Logger;
}): HealthService {
  const log = deps.log.child({ module: "health.service" });

  return {
    async check() {
      try {
        await deps.ping();
        return { status: "ok", commit: deps.commit };
      } catch (error) {
        log.error({ err: error }, "database health check failed");
        return { status: "error", commit: deps.commit };
      }
    },
  };
}
