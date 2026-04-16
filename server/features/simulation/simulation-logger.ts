/**
 * Minimal structured logger interface for the simulation engine.
 *
 * Compatible with pino.Logger so callers can pass a real pino instance,
 * but the simulation module itself stays dependency-free.
 */
export interface SimLogger {
  info(obj: Record<string, unknown>, msg: string): void;
  debug(obj: Record<string, unknown>, msg: string): void;
  child(bindings: Record<string, unknown>): SimLogger;
}

function createNoopLogger(): SimLogger {
  const noop: SimLogger = {
    info() {},
    debug() {},
    child() {
      return noop;
    },
  };
  return noop;
}

export const noopLogger: SimLogger = createNoopLogger();
