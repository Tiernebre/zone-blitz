import { assertEquals, assertGreater, assertLess } from "@std/assert";
import { createSeededRng } from "./rng.ts";
import type { PlayerRuntime } from "./resolve-play.ts";
import {
  PLAYER_ATTRIBUTE_KEYS,
  type PlayerAttributes,
} from "@zone-blitz/shared";
import { resolveFieldGoal } from "./resolve-field-goal.ts";

function makeAttributes(
  overrides: Partial<PlayerAttributes> = {},
): PlayerAttributes {
  const base: Partial<PlayerAttributes> = {};
  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    (base as Record<string, number>)[key] = 50;
    (base as Record<string, number>)[`${key}Potential`] = 50;
  }
  return { ...base, ...overrides } as PlayerAttributes;
}

function makeKicker(
  overrides: Partial<PlayerAttributes> = {},
): PlayerRuntime {
  return {
    playerId: "kicker-1",
    neutralBucket: "K",
    attributes: makeAttributes({
      kickingPower: 75,
      kickingAccuracy: 75,
      ...overrides,
    }),
  };
}

Deno.test("resolveFieldGoal", async (t) => {
  await t.step("returns a FieldGoalResult with valid outcome", () => {
    const rng = createSeededRng(42);
    const result = resolveFieldGoal({
      kicker: makeKicker(),
      yardLine: 65,
      rng,
    });

    assertEquals(
      result.outcome === "made" || result.outcome === "missed" ||
        result.outcome === "blocked",
      true,
    );
    assertEquals(typeof result.distance, "number");
  });

  await t.step("determinism: same seed produces same result", () => {
    const params = {
      kicker: makeKicker(),
      yardLine: 65,
    };

    const r1 = resolveFieldGoal({ ...params, rng: createSeededRng(123) });
    const r2 = resolveFieldGoal({ ...params, rng: createSeededRng(123) });

    assertEquals(r1, r2);
  });

  await t.step("distance is computed as 100 - yardLine + 17", () => {
    const result = resolveFieldGoal({
      kicker: makeKicker(),
      yardLine: 65,
      rng: createSeededRng(42),
    });

    assertEquals(result.distance, 100 - 65 + 17);
  });

  await t.step("short FGs have higher success rate than long FGs", () => {
    const trials = 500;
    let shortMade = 0;
    let longMade = 0;

    for (let seed = 1; seed <= trials; seed++) {
      const short = resolveFieldGoal({
        kicker: makeKicker(),
        yardLine: 80,
        rng: createSeededRng(seed),
      });
      const long = resolveFieldGoal({
        kicker: makeKicker(),
        yardLine: 50,
        rng: createSeededRng(seed),
      });
      if (short.outcome === "made") shortMade++;
      if (long.outcome === "made") longMade++;
    }

    assertGreater(shortMade / trials, longMade / trials);
  });

  await t.step(
    "kicker accuracy attribute improves success rate",
    () => {
      const trials = 500;
      let accurateMade = 0;
      let inaccurateMade = 0;

      for (let seed = 1; seed <= trials; seed++) {
        const accurate = resolveFieldGoal({
          kicker: makeKicker({ kickingAccuracy: 99 }),
          yardLine: 60,
          rng: createSeededRng(seed),
        });
        const inaccurate = resolveFieldGoal({
          kicker: makeKicker({ kickingAccuracy: 20 }),
          yardLine: 60,
          rng: createSeededRng(seed),
        });
        if (accurate.outcome === "made") accurateMade++;
        if (inaccurate.outcome === "made") inaccurateMade++;
      }

      assertGreater(accurateMade / trials, inaccurateMade / trials);
    },
  );

  await t.step("kicker power affects success on long FGs", () => {
    const trials = 500;
    let strongMade = 0;
    let weakMade = 0;

    for (let seed = 1; seed <= trials; seed++) {
      const strong = resolveFieldGoal({
        kicker: makeKicker({ kickingPower: 99 }),
        yardLine: 50,
        rng: createSeededRng(seed),
      });
      const weak = resolveFieldGoal({
        kicker: makeKicker({ kickingPower: 20 }),
        yardLine: 50,
        rng: createSeededRng(seed),
      });
      if (strong.outcome === "made") strongMade++;
      if (weak.outcome === "made") weakMade++;
    }

    assertGreater(strongMade / trials, weakMade / trials);
  });

  await t.step("weather modifier reduces success rate", () => {
    const trials = 500;
    let clearMade = 0;
    let badWeatherMade = 0;

    for (let seed = 1; seed <= trials; seed++) {
      const clear = resolveFieldGoal({
        kicker: makeKicker(),
        yardLine: 60,
        rng: createSeededRng(seed),
      });
      const badWeather = resolveFieldGoal({
        kicker: makeKicker(),
        yardLine: 60,
        weatherPenalty: 0.15,
        rng: createSeededRng(seed),
      });
      if (clear.outcome === "made") clearMade++;
      if (badWeather.outcome === "made") badWeatherMade++;
    }

    assertGreater(clearMade / trials, badWeatherMade / trials);
  });

  await t.step(
    "missed FG from 50+ returns spot of kick, not line of scrimmage",
    () => {
      let foundLongMiss = false;
      for (let seed = 1; seed <= 1000 && !foundLongMiss; seed++) {
        const result = resolveFieldGoal({
          kicker: makeKicker({ kickingAccuracy: 30 }),
          yardLine: 45,
          rng: createSeededRng(seed),
        });
        if (result.outcome === "missed" && result.distance >= 50) {
          foundLongMiss = true;
          assertEquals(result.returnToSpotOfKick, true);
          assertEquals(result.defenseYardLine, 100 - 45);
        }
      }
      assertEquals(foundLongMiss, true);
    },
  );

  await t.step(
    "missed FG under 50 returns to previous line of scrimmage",
    () => {
      let foundShortMiss = false;
      for (let seed = 1; seed <= 1000 && !foundShortMiss; seed++) {
        const result = resolveFieldGoal({
          kicker: makeKicker({ kickingAccuracy: 30 }),
          yardLine: 70,
          rng: createSeededRng(seed),
        });
        if (result.outcome === "missed" && result.distance < 50) {
          foundShortMiss = true;
          assertEquals(result.returnToSpotOfKick, false);
          assertEquals(result.defenseYardLine, 100 - 70);
        }
      }
      assertEquals(foundShortMiss, true);
    },
  );

  await t.step("blocked kicks can occur", () => {
    let foundBlocked = false;
    for (let seed = 1; seed <= 2000 && !foundBlocked; seed++) {
      const result = resolveFieldGoal({
        kicker: makeKicker({ kickingAccuracy: 20, kickingPower: 20 }),
        yardLine: 60,
        rng: createSeededRng(seed),
      });
      if (result.outcome === "blocked") {
        foundBlocked = true;
        assertEquals(result.blocked, true);
      }
    }
    assertEquals(foundBlocked, true);
  });

  await t.step("blocked kick returns defenseYardLine at spot", () => {
    let foundBlocked = false;
    for (let seed = 1; seed <= 2000 && !foundBlocked; seed++) {
      const result = resolveFieldGoal({
        kicker: makeKicker({ kickingAccuracy: 20, kickingPower: 20 }),
        yardLine: 60,
        rng: createSeededRng(seed),
      });
      if (result.outcome === "blocked") {
        foundBlocked = true;
        assertEquals(result.defenseYardLine, 100 - 60);
      }
    }
    assertEquals(foundBlocked, true);
  });

  await t.step(
    "close-range FGs are almost always made with good kicker",
    () => {
      const trials = 200;
      let made = 0;
      for (let seed = 1; seed <= trials; seed++) {
        const result = resolveFieldGoal({
          kicker: makeKicker({ kickingAccuracy: 90, kickingPower: 90 }),
          yardLine: 90,
          rng: createSeededRng(seed),
        });
        if (result.outcome === "made") made++;
      }

      assertGreater(made / trials, 0.9);
    },
  );

  await t.step("very long FGs have low success rate", () => {
    const trials = 500;
    let made = 0;
    for (let seed = 1; seed <= trials; seed++) {
      const result = resolveFieldGoal({
        kicker: makeKicker({ kickingAccuracy: 50, kickingPower: 50 }),
        yardLine: 40,
        rng: createSeededRng(seed),
      });
      if (result.outcome === "made") made++;
    }

    assertLess(made / trials, 0.75);
  });
});
