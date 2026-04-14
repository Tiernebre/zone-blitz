import { assertEquals, assertRejects } from "@std/assert";
import { createTransactionRunner } from "./transaction-runner.ts";
import type { Database } from "./connection.ts";

function createFakeDb(): {
  db: Database;
  calls: Array<(tx: unknown) => Promise<unknown>>;
  txMarker: object;
} {
  const calls: Array<(tx: unknown) => Promise<unknown>> = [];
  const txMarker = { __tx: true };
  const db = {
    transaction: <T>(fn: (tx: unknown) => Promise<T>) => {
      calls.push(fn);
      return fn(txMarker);
    },
  } as unknown as Database;
  return { db, calls, txMarker };
}

Deno.test("transaction-runner", async (t) => {
  await t.step("run passes the tx handle into the callback", async () => {
    const { db, txMarker } = createFakeDb();
    const runner = createTransactionRunner(db);

    let receivedTx: unknown;
    const result = await runner.run((tx) => {
      receivedTx = tx;
      return Promise.resolve("ok");
    });

    assertEquals(receivedTx, txMarker);
    assertEquals(result, "ok");
  });

  await t.step("run propagates rejections from the callback", async () => {
    const { db } = createFakeDb();
    const runner = createTransactionRunner(db);

    await assertRejects(
      () => runner.run(() => Promise.reject(new Error("boom"))),
      Error,
      "boom",
    );
  });
});
