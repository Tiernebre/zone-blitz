import type { Executor } from "./connection.ts";

export const DEFAULT_CHUNK_SIZE = 100;

export async function chunkedInsert(
  exec: Executor,
  // deno-lint-ignore no-explicit-any
  table: any,
  rows: readonly Record<string, unknown>[],
  chunkSize: number = DEFAULT_CHUNK_SIZE,
): Promise<void> {
  for (let i = 0; i < rows.length; i += chunkSize) {
    // deno-lint-ignore no-explicit-any
    await (exec.insert as any)(table).values(rows.slice(i, i + chunkSize));
  }
}

export async function chunkedInsertReturning<R>(
  exec: Executor,
  // deno-lint-ignore no-explicit-any
  table: any,
  rows: readonly Record<string, unknown>[],
  returning: Record<string, unknown>,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    // deno-lint-ignore no-explicit-any
    const batch = await (exec.insert as any)(table)
      .values(rows.slice(i, i + chunkSize))
      .returning(returning);
    results.push(...(batch as R[]));
  }
  return results;
}
