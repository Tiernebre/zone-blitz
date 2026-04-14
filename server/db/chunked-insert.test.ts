import { assertEquals } from "@std/assert";
import {
  chunkedInsert,
  chunkedInsertReturning,
  DEFAULT_CHUNK_SIZE,
} from "./chunked-insert.ts";

interface Call {
  rows: unknown[];
  returning?: unknown;
}

function createMockExec(
  onReturning?: (rows: unknown[]) => unknown[],
): {
  exec: Parameters<typeof chunkedInsert>[0];
  calls: Call[];
} {
  const calls: Call[] = [];
  const exec = {
    insert() {
      return {
        values(rows: unknown[]) {
          const call: Call = { rows };
          calls.push(call);
          const base = Promise.resolve([]);
          return Object.assign(base, {
            returning(spec: unknown) {
              call.returning = spec;
              return Promise.resolve(onReturning?.(rows) ?? []);
            },
          });
        },
      };
    },
  } as unknown as Parameters<typeof chunkedInsert>[0];
  return { exec, calls };
}

Deno.test("chunkedInsert", async (t) => {
  await t.step("default chunk size is 100", () => {
    assertEquals(DEFAULT_CHUNK_SIZE, 100);
  });

  await t.step("splits rows into batches of the default size", async () => {
    const { exec, calls } = createMockExec();
    const rows = Array.from({ length: 250 }, (_, i) => ({ id: i }));

    // deno-lint-ignore no-explicit-any
    await chunkedInsert(exec, {} as any, rows);

    assertEquals(calls.length, 3);
    assertEquals(calls[0].rows.length, 100);
    assertEquals(calls[1].rows.length, 100);
    assertEquals(calls[2].rows.length, 50);
  });

  await t.step("respects a custom chunk size", async () => {
    const { exec, calls } = createMockExec();
    const rows = Array.from({ length: 10 }, (_, i) => ({ id: i }));

    // deno-lint-ignore no-explicit-any
    await chunkedInsert(exec, {} as any, rows, 3);

    assertEquals(calls.length, 4);
    assertEquals(calls[3].rows.length, 1);
  });

  await t.step("does nothing when rows are empty", async () => {
    const { exec, calls } = createMockExec();

    // deno-lint-ignore no-explicit-any
    await chunkedInsert(exec, {} as any, []);

    assertEquals(calls.length, 0);
  });
});

Deno.test("chunkedInsertReturning", async (t) => {
  await t.step(
    "concatenates returned rows across batches preserving order",
    async () => {
      const { exec, calls } = createMockExec((batch) =>
        (batch as { id: number }[]).map((r) => ({ id: r.id }))
      );
      const rows = Array.from({ length: 250 }, (_, i) => ({ id: i }));

      const result = await chunkedInsertReturning<{ id: number }>(
        exec,
        // deno-lint-ignore no-explicit-any
        {} as any,
        rows,
        { id: "id" },
      );

      assertEquals(calls.length, 3);
      assertEquals(result.length, 250);
      assertEquals(result[0].id, 0);
      assertEquals(result[249].id, 249);
      assertEquals(calls[0].returning, { id: "id" });
    },
  );

  await t.step("returns empty array when rows are empty", async () => {
    const { exec, calls } = createMockExec();

    const result = await chunkedInsertReturning<{ id: number }>(
      exec,
      // deno-lint-ignore no-explicit-any
      {} as any,
      [],
      { id: "id" },
    );

    assertEquals(result, []);
    assertEquals(calls.length, 0);
  });
});
