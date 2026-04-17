import { assertEquals } from "@std/assert";
import { intInRange } from "./int-in-range.ts";
import { mulberry32 } from "../rng/rng.ts";

Deno.test("intInRange returns values within inclusive bounds", () => {
  const random = mulberry32(42);
  for (let i = 0; i < 200; i++) {
    const value = intInRange(random, 1, 6);
    assertEquals(value >= 1 && value <= 6, true);
    assertEquals(Number.isInteger(value), true);
  }
});

Deno.test("intInRange returns the only value when min equals max", () => {
  const random = mulberry32(1);
  assertEquals(intInRange(random, 5, 5), 5);
});

Deno.test("intInRange matches SeededRng.int output for the same stream", () => {
  const randomA = mulberry32(99);
  const randomB = mulberry32(99);
  for (let i = 0; i < 20; i++) {
    assertEquals(
      intInRange(randomA, 0, 100),
      Math.floor(randomB() * 101) + 0,
    );
  }
});
