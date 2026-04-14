import { assertEquals } from "@std/assert";
import { createSeededRng, hashSeed } from "./seeded-rng.ts";

Deno.test("same seed produces the same sequence", () => {
  const a = createSeededRng(42);
  const b = createSeededRng(42);
  for (let i = 0; i < 100; i++) {
    assertEquals(a.next(), b.next());
  }
});

Deno.test("different seeds produce different sequences", () => {
  const a = createSeededRng(1);
  const b = createSeededRng(2);
  let same = 0;
  for (let i = 0; i < 100; i++) {
    if (a.next() === b.next()) same++;
  }
  assertEquals(same < 10, true);
});

Deno.test("next returns values in [0, 1)", () => {
  const rng = createSeededRng(99);
  for (let i = 0; i < 1000; i++) {
    const v = rng.next();
    assertEquals(v >= 0 && v < 1, true);
  }
});

Deno.test("nextInt returns values in [min, max]", () => {
  const rng = createSeededRng(7);
  for (let i = 0; i < 500; i++) {
    const v = rng.nextInt(10, 20);
    assertEquals(v >= 10 && v <= 20, true);
    assertEquals(Number.isInteger(v), true);
  }
});

Deno.test("nextFloat returns values in [min, max)", () => {
  const rng = createSeededRng(13);
  for (let i = 0; i < 500; i++) {
    const v = rng.nextFloat(5.0, 10.0);
    assertEquals(v >= 5.0 && v < 10.0, true);
  }
});

Deno.test("pick returns elements from the array", () => {
  const rng = createSeededRng(55);
  const items = ["a", "b", "c"] as const;
  for (let i = 0; i < 100; i++) {
    const v = rng.pick(items);
    assertEquals(items.includes(v), true);
  }
});

Deno.test("hashSeed is deterministic", () => {
  assertEquals(hashSeed("hello"), hashSeed("hello"));
});

Deno.test("hashSeed produces different values for different inputs", () => {
  const a = hashSeed("foo");
  const b = hashSeed("bar");
  assertEquals(a !== b, true);
});
