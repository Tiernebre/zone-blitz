import { assertEquals } from "@std/assert";
import { createHealthService } from "./health.service.ts";
import type { HealthStatus } from "./health.service.interface.ts";
import pino from "pino";

function createTestLogger() {
  return pino({ level: "silent" });
}

Deno.test("health.service", async (t) => {
  await t.step("check returns ok when database is reachable", async () => {
    const service = createHealthService({
      ping: () => Promise.resolve(),
      commit: "abc123",
      log: createTestLogger(),
    });

    const result: HealthStatus = await service.check();
    assertEquals(result.status, "ok");
    assertEquals(result.commit, "abc123");
  });

  await t.step("check returns error when database is unreachable", async () => {
    const service = createHealthService({
      ping: () => Promise.reject(new Error("connection refused")),
      commit: "abc123",
      log: createTestLogger(),
    });

    const result: HealthStatus = await service.check();
    assertEquals(result.status, "error");
    assertEquals(result.commit, "abc123");
  });
});
