import { assertEquals, assertRejects } from "@std/assert";
import { createUserService } from "./user.service.ts";
import type { UserRepository } from "@zone-blitz/shared";

function createMockUserRepo(
  overrides: Partial<UserRepository> = {},
): UserRepository {
  return {
    deleteById: () => Promise.resolve(),
    ...overrides,
  };
}

function createTestLogger() {
  return {
    child: () => createTestLogger(),
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  } as unknown as import("pino").Logger;
}

Deno.test("user.service", async (t) => {
  await t.step("deleteById delegates to repository", async () => {
    let deletedId: string | undefined;
    const repo = createMockUserRepo({
      deleteById: (id) => {
        deletedId = id;
        return Promise.resolve();
      },
    });
    const service = createUserService({
      userRepo: repo,
      log: createTestLogger(),
    });

    await service.deleteById("user-123");
    assertEquals(deletedId, "user-123");
  });

  await t.step("deleteById propagates repository errors", async () => {
    const repo = createMockUserRepo({
      deleteById: () => Promise.reject(new Error("db error")),
    });
    const service = createUserService({
      userRepo: repo,
      log: createTestLogger(),
    });

    await assertRejects(
      () => service.deleteById("user-123"),
      Error,
      "db error",
    );
  });
});
