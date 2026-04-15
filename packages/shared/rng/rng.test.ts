import { assertEquals, assertNotEquals } from "@std/assert";
import {
  createRng,
  createSeededRng,
  deriveGameSeed,
  mulberry32,
} from "./rng.ts";
import type { SeededRng } from "./rng.ts";

Deno.test("mulberry32", async (t) => {
  await t.step("produces identical sequence for same seed", () => {
    const rng1 = mulberry32(12345);
    const rng2 = mulberry32(12345);
    for (let i = 0; i < 100; i++) {
      assertEquals(rng1(), rng2());
    }
  });

  await t.step("produces different sequences for different seeds", () => {
    const rng1 = mulberry32(12345);
    const rng2 = mulberry32(54321);
    let allSame = true;
    for (let i = 0; i < 10; i++) {
      if (rng1() !== rng2()) {
        allSame = false;
        break;
      }
    }
    assertEquals(allSame, false);
  });

  await t.step("returns values in [0, 1) range", () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      const val = rng();
      assertEquals(val >= 0 && val < 1, true);
    }
  });

  await t.step("is byte-identical on fixed seed across calls", () => {
    const rng = mulberry32(99999);
    const expected = [
      rng(),
      rng(),
      rng(),
      rng(),
      rng(),
    ];

    const rng2 = mulberry32(99999);
    for (let i = 0; i < expected.length; i++) {
      assertEquals(rng2(), expected[i]);
    }
  });
});

Deno.test("createRng", async (t) => {
  await t.step("next() returns raw values from underlying generator", () => {
    const raw = mulberry32(42);
    const rng = createRng(mulberry32(42));
    for (let i = 0; i < 10; i++) {
      assertEquals(rng.next(), raw());
    }
  });

  await t.step("int() returns values in inclusive range", () => {
    const rng = createRng(mulberry32(42));
    for (let i = 0; i < 100; i++) {
      const val = rng.int(1, 6);
      assertEquals(val >= 1 && val <= 6, true);
      assertEquals(Number.isInteger(val), true);
    }
  });

  await t.step("pick() returns element from array", () => {
    const rng = createRng(mulberry32(42));
    const items = ["a", "b", "c", "d"] as const;
    for (let i = 0; i < 50; i++) {
      const val = rng.pick(items);
      assertEquals(items.includes(val), true);
    }
  });

  await t.step("gaussian() returns values clamped to range", () => {
    const rng = createRng(mulberry32(42));
    for (let i = 0; i < 100; i++) {
      const val = rng.gaussian(50, 10, 20, 80);
      assertEquals(val >= 20 && val <= 80, true);
      assertEquals(Number.isInteger(val), true);
    }
  });

  await t.step("is deterministic with same seed", () => {
    const rng1 = createRng(mulberry32(777));
    const rng2 = createRng(mulberry32(777));
    for (let i = 0; i < 20; i++) {
      assertEquals(rng1.int(0, 100), rng2.int(0, 100));
    }
  });
});

Deno.test("createSeededRng", async (t) => {
  await t.step("combines mulberry32 and createRng", () => {
    const convenience = createSeededRng(42);
    const manual = createRng(mulberry32(42));
    for (let i = 0; i < 20; i++) {
      assertEquals(convenience.next(), manual.next());
    }
  });

  await t.step("returns a valid SeededRng interface", () => {
    const rng: SeededRng = createSeededRng(12345);
    assertEquals(typeof rng.next, "function");
    assertEquals(typeof rng.int, "function");
    assertEquals(typeof rng.pick, "function");
    assertEquals(typeof rng.gaussian, "function");
  });
});

Deno.test("deriveGameSeed", async (t) => {
  await t.step("returns deterministic seed for same inputs", () => {
    const seed1 = deriveGameSeed(42, "game-1");
    const seed2 = deriveGameSeed(42, "game-1");
    assertEquals(seed1, seed2);
  });

  await t.step("returns different seeds for different game identifiers", () => {
    const seed1 = deriveGameSeed(42, "game-1");
    const seed2 = deriveGameSeed(42, "game-2");
    assertNotEquals(seed1, seed2);
  });

  await t.step("returns different seeds for different league seeds", () => {
    const seed1 = deriveGameSeed(42, "game-1");
    const seed2 = deriveGameSeed(43, "game-1");
    assertNotEquals(seed1, seed2);
  });

  await t.step("returns a 32-bit unsigned integer", () => {
    const seed = deriveGameSeed(12345, "week-1-game-3");
    assertEquals(seed >= 0, true);
    assertEquals(seed <= 0xFFFFFFFF, true);
    assertEquals(Number.isInteger(seed), true);
  });

  await t.step("a week of games is reproducible from a league seed", () => {
    const leagueSeed = 2026;
    const gameIds = [
      "week1-game1",
      "week1-game2",
      "week1-game3",
      "week1-game4",
    ];

    const seeds1 = gameIds.map((id) => deriveGameSeed(leagueSeed, id));
    const seeds2 = gameIds.map((id) => deriveGameSeed(leagueSeed, id));
    assertEquals(seeds1, seeds2);

    const uniqueSeeds = new Set(seeds1);
    assertEquals(uniqueSeeds.size, gameIds.length);
  });
});
