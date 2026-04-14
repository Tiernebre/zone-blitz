import type { Executor } from "./connection.ts";

export const DEFAULT_CHUNK_SIZE = 100;
export const MAX_PARAMETERS_PER_BATCH = 5_000;

function effectiveChunkSize(
  rows: readonly Record<string, unknown>[],
  chunkSize: number,
): number {
  if (rows.length === 0) return chunkSize;
  const columnCount = Object.keys(rows[0]).length;
  if (columnCount === 0) return chunkSize;
  const maxByParams = Math.max(
    1,
    Math.floor(MAX_PARAMETERS_PER_BATCH / columnCount),
  );
  return Math.min(chunkSize, maxByParams);
}

export async function chunkedInsert(
  exec: Executor,
  // deno-lint-ignore no-explicit-any
  table: any,
  rows: readonly Record<string, unknown>[],
  chunkSize: number = DEFAULT_CHUNK_SIZE,
): Promise<void> {
  const size = effectiveChunkSize(rows, chunkSize);
  for (let i = 0; i < rows.length; i += size) {
    // deno-lint-ignore no-explicit-any
    await (exec.insert as any)(table).values(rows.slice(i, i + size));
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
  const size = effectiveChunkSize(rows, chunkSize);
  const results: R[] = [];
  for (let i = 0; i < rows.length; i += size) {
    // deno-lint-ignore no-explicit-any
    const batch = await (exec.insert as any)(table)
      .values(rows.slice(i, i + size))
      .returning(returning);
    results.push(...(batch as R[]));
  }
  return results;
}
