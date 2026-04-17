import { assertEquals } from "@std/assert";
import { distributeByWeight } from "./distribute-by-weight.ts";

Deno.test("distributeByWeight allocates exact total across keys", () => {
  const result = distributeByWeight(10, [
    { key: "a", weight: 1 },
    { key: "b", weight: 1 },
  ]);
  assertEquals(result.get("a"), 5);
  assertEquals(result.get("b"), 5);
});

Deno.test("distributeByWeight respects weighted ratios", () => {
  const result = distributeByWeight(9, [
    { key: "a", weight: 2 },
    { key: "b", weight: 1 },
  ]);
  assertEquals(result.get("a"), 6);
  assertEquals(result.get("b"), 3);
});

Deno.test("distributeByWeight sends remainder to largest fractional parts", () => {
  const result = distributeByWeight(7, [
    { key: "a", weight: 1 },
    { key: "b", weight: 1 },
    { key: "c", weight: 1 },
  ]);
  const sum = (result.get("a") ?? 0) + (result.get("b") ?? 0) +
    (result.get("c") ?? 0);
  assertEquals(sum, 7);
});

Deno.test("distributeByWeight preserves sum for non-integer exact shares", () => {
  const result = distributeByWeight(5, [
    { key: "a", weight: 0.5 },
    { key: "b", weight: 0.5 },
    { key: "c", weight: 0.75 },
    { key: "d", weight: 0.75 },
  ]);
  let sum = 0;
  for (const value of result.values()) sum += value;
  assertEquals(sum, 5);
});

Deno.test("distributeByWeight returns zeros when total is zero", () => {
  const result = distributeByWeight(0, [
    { key: "a", weight: 1 },
    { key: "b", weight: 2 },
  ]);
  assertEquals(result.get("a"), 0);
  assertEquals(result.get("b"), 0);
});

Deno.test("distributeByWeight is generic over key type", () => {
  type Role = "OC" | "DC";
  const result = distributeByWeight<Role>(4, [
    { key: "OC", weight: 1 },
    { key: "DC", weight: 1 },
  ]);
  assertEquals(result.get("OC"), 2);
  assertEquals(result.get("DC"), 2);
});
