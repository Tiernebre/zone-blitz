import { assertEquals } from "@std/assert";
import { clamp } from "./clamp.ts";

Deno.test("clamp returns value when inside range", () => {
  assertEquals(clamp(5, 0, 10), 5);
});

Deno.test("clamp raises value below min up to min", () => {
  assertEquals(clamp(-3, 0, 10), 0);
});

Deno.test("clamp lowers value above max down to max", () => {
  assertEquals(clamp(42, 0, 10), 10);
});

Deno.test("clamp returns min when value equals min", () => {
  assertEquals(clamp(0, 0, 10), 0);
});

Deno.test("clamp returns max when value equals max", () => {
  assertEquals(clamp(10, 0, 10), 10);
});

Deno.test("clamp handles negative ranges", () => {
  assertEquals(clamp(-5, -10, -1), -5);
  assertEquals(clamp(-20, -10, -1), -10);
  assertEquals(clamp(5, -10, -1), -1);
});

Deno.test("clamp handles floating-point values", () => {
  assertEquals(clamp(1.5, 0, 2), 1.5);
  assertEquals(clamp(2.5, 0, 2), 2);
});
