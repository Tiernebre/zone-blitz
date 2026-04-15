import { assertAlmostEquals, assertEquals } from "@std/assert";
import { computeDistribution } from "./compute-distribution.ts";

Deno.test("computeDistribution computes mean correctly", () => {
  const values = [10, 20, 30, 40, 50];
  const result = computeDistribution(values);
  assertEquals(result.mean, 30);
});

Deno.test("computeDistribution computes sd correctly", () => {
  const values = [2, 4, 4, 4, 5, 5, 7, 9];
  const result = computeDistribution(values);
  assertEquals(result.mean, 5);
  assertAlmostEquals(result.sd, 2.0, 0.01);
});

Deno.test("computeDistribution computes p10 and p90", () => {
  const values = Array.from({ length: 100 }, (_, i) => i + 1);
  const result = computeDistribution(values);
  assertAlmostEquals(result.p10, 10.9, 0.1);
  assertAlmostEquals(result.p90, 90.1, 0.1);
});

Deno.test("computeDistribution sets n from array length", () => {
  const values = [1, 2, 3];
  const result = computeDistribution(values);
  assertEquals(result.n, 3);
});

Deno.test("computeDistribution handles single value", () => {
  const result = computeDistribution([42]);
  assertEquals(result.mean, 42);
  assertEquals(result.sd, 0);
  assertEquals(result.p10, 42);
  assertEquals(result.p90, 42);
  assertEquals(result.n, 1);
});
