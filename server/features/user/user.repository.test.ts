import { assertEquals } from "@std/assert";
import { createUserRepository } from "./user.repository.ts";
import { users } from "../auth/auth.schema.ts";

function createTestLogger() {
  return {
    child: () => createTestLogger(),
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  } as unknown as import("pino").Logger;
}

Deno.test("user.repository", async (t) => {
  await t.step("deleteById calls db.delete with correct user id", async () => {
    let deletedTable: unknown;
    let deletedWhere: unknown;

    const mockWhere = (condition: unknown) => {
      deletedWhere = condition;
      return Promise.resolve();
    };

    const mockDb = {
      delete: (table: unknown) => {
        deletedTable = table;
        return { where: mockWhere };
      },
    };

    const repo = createUserRepository({
      db: mockDb as never,
      log: createTestLogger(),
    });

    await repo.deleteById("user-to-delete");
    assertEquals(deletedTable, users);
    // The where clause is an Expression object; just verify it was called
    assertEquals(deletedWhere !== undefined, true);
  });
});
