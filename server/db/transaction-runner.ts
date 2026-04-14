import type { Database, Executor } from "./connection.ts";

export interface TransactionRunner {
  run<T>(fn: (tx: Executor) => Promise<T>): Promise<T>;
}

export function createTransactionRunner(db: Database): TransactionRunner {
  return {
    run: (fn) => db.transaction(fn),
  };
}
