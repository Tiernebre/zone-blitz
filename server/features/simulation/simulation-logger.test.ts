import { assertEquals } from "@std/assert";
import { noopLogger, type SimLogger } from "./simulation-logger.ts";

Deno.test("noopLogger", async (t) => {
  await t.step("info does not throw", () => {
    noopLogger.info({ key: "value" }, "test message");
  });

  await t.step("debug does not throw", () => {
    noopLogger.debug({ key: "value" }, "test message");
  });

  await t.step("child returns a logger that also does not throw", () => {
    const child = noopLogger.child({ module: "test" });
    child.info({}, "child info");
    child.debug({}, "child debug");
  });

  await t.step("child of child returns a logger", () => {
    const grandchild = noopLogger.child({ a: 1 }).child({ b: 2 });
    grandchild.info({}, "grandchild info");
  });
});

export function createSpyLogger(): {
  logger: SimLogger;
  calls: {
    level: "info" | "debug";
    obj: Record<string, unknown>;
    msg: string;
  }[];
} {
  const calls: {
    level: "info" | "debug";
    obj: Record<string, unknown>;
    msg: string;
  }[] = [];

  function makeLogger(
    bindings: Record<string, unknown>,
  ): SimLogger {
    return {
      info(obj: Record<string, unknown>, msg: string) {
        calls.push({ level: "info", obj: { ...bindings, ...obj }, msg });
      },
      debug(obj: Record<string, unknown>, msg: string) {
        calls.push({ level: "debug", obj: { ...bindings, ...obj }, msg });
      },
      child(childBindings: Record<string, unknown>) {
        return makeLogger({ ...bindings, ...childBindings });
      },
    };
  }

  return { logger: makeLogger({}), calls };
}

Deno.test("createSpyLogger", async (t) => {
  await t.step("captures info calls with bindings", () => {
    const { logger, calls } = createSpyLogger();
    const child = logger.child({ module: "test" });
    child.info({ gameId: "g1" }, "game started");

    assertEquals(calls.length, 1);
    assertEquals(calls[0].level, "info");
    assertEquals(calls[0].msg, "game started");
    assertEquals(calls[0].obj.module, "test");
    assertEquals(calls[0].obj.gameId, "g1");
  });

  await t.step("captures debug calls", () => {
    const { logger, calls } = createSpyLogger();
    logger.debug({ yards: 5 }, "play resolved");

    assertEquals(calls.length, 1);
    assertEquals(calls[0].level, "debug");
  });
});
