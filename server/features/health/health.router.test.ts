import { assertEquals } from "@std/assert";
import { createHealthRouter } from "./health.router.ts";
import type { HealthService } from "@zone-blitz/shared";

function createMockHealthService(
  overrides: Partial<HealthService> = {},
): HealthService {
  return {
    check: () => Promise.resolve({ status: "ok", commit: "test-sha" }),
    ...overrides,
  };
}

Deno.test("health.router", async (t) => {
  await t.step("GET / returns 200 when health check is ok", async () => {
    const router = createHealthRouter(
      createMockHealthService({
        check: () => Promise.resolve({ status: "ok", commit: "abc123" }),
      }),
    );

    const res = await router.request("/");
    assertEquals(res.status, 200);

    const body = await res.json();
    assertEquals(body.status, "ok");
    assertEquals(body.commit, "abc123");
  });

  await t.step("GET / returns 500 when health check is error", async () => {
    const router = createHealthRouter(
      createMockHealthService({
        check: () => Promise.resolve({ status: "error", commit: "abc123" }),
      }),
    );

    const res = await router.request("/");
    assertEquals(res.status, 500);

    const body = await res.json();
    assertEquals(body.status, "error");
  });
});
