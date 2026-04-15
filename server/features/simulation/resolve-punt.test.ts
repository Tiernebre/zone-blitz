import { assertEquals, assertGreater } from "@std/assert";
import { createSeededRng } from "./rng.ts";
import type { PlayerRuntime } from "./resolve-play.ts";
import {
  PLAYER_ATTRIBUTE_KEYS,
  type PlayerAttributes,
} from "@zone-blitz/shared";
import { type PuntOutcome, resolvePunt } from "./resolve-punt.ts";

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

function makePunter(
  overrides: Partial<PlayerAttributes> = {},
): PlayerRuntime {
  return {
    playerId: "punter-1",
    neutralBucket: "P",
    attributes: makeAttributes({
      puntingPower: 70,
      puntingAccuracy: 70,
      ...overrides,
    }),
  };
}

function makeReturner(
  overrides: Partial<PlayerAttributes> = {},
): PlayerRuntime {
  return {
    playerId: "returner-1",
    neutralBucket: "WR",
    attributes: makeAttributes({
      speed: 80,
      agility: 75,
      acceleration: 75,
      ...overrides,
    }),
  };
}

function makeCoverageUnit(): PlayerRuntime[] {
  return [
    {
      playerId: "gunner-1",
      neutralBucket: "WR",
      attributes: makeAttributes({ speed: 70, acceleration: 70 }),
    },
    {
      playerId: "gunner-2",
      neutralBucket: "S",
      attributes: makeAttributes({ speed: 65, acceleration: 65 }),
    },
  ];
}

const VALID_OUTCOMES: PuntOutcome[] = [
  "fair_catch",
  "return",
  "downed_inside_10",
  "touchback",
  "muffed_punt",
  "blocked_punt",
];

Deno.test("resolvePunt", async (t) => {
  await t.step("returns a PuntResult with valid outcome", () => {
    const rng = createSeededRng(42);
    const result = resolvePunt({
      punter: makePunter(),
      returner: makeReturner(),
      coverageUnit: makeCoverageUnit(),
      yardLine: 25,
      rng,
    });

    assertEquals(VALID_OUTCOMES.includes(result.outcome), true);
    assertEquals(typeof result.netYards, "number");
    assertEquals(typeof result.landingYardLine, "number");
  });

  await t.step("determinism: same seed produces same result", () => {
    const params = {
      punter: makePunter(),
      returner: makeReturner(),
      coverageUnit: makeCoverageUnit(),
      yardLine: 25,
    };

    const r1 = resolvePunt({ ...params, rng: createSeededRng(123) });
    const r2 = resolvePunt({ ...params, rng: createSeededRng(123) });

    assertEquals(r1, r2);
  });

  await t.step("landing yard line is within valid field bounds", () => {
    for (let seed = 1; seed <= 100; seed++) {
      const result = resolvePunt({
        punter: makePunter(),
        returner: makeReturner(),
        coverageUnit: makeCoverageUnit(),
        yardLine: 30,
        rng: createSeededRng(seed),
      });

      assertEquals(result.landingYardLine >= 0, true);
      assertEquals(result.landingYardLine <= 100, true);
    }
  });

  await t.step(
    "distribution produces all non-block/muff outcomes across many seeds",
    () => {
      const seenOutcomes = new Set<PuntOutcome>();

      for (let seed = 1; seed <= 500; seed++) {
        const result = resolvePunt({
          punter: makePunter(),
          returner: makeReturner(),
          coverageUnit: makeCoverageUnit(),
          yardLine: 30,
          rng: createSeededRng(seed),
        });
        seenOutcomes.add(result.outcome);
      }

      assertEquals(seenOutcomes.has("fair_catch"), true);
      assertEquals(seenOutcomes.has("return"), true);
      assertEquals(seenOutcomes.has("touchback"), true);
    },
  );

  await t.step("punter attributes affect net distance", () => {
    let strongTotal = 0;
    let weakTotal = 0;
    const trials = 200;

    for (let seed = 1; seed <= trials; seed++) {
      const strong = resolvePunt({
        punter: makePunter({ puntingPower: 99, puntingAccuracy: 99 }),
        returner: makeReturner(),
        coverageUnit: makeCoverageUnit(),
        yardLine: 25,
        rng: createSeededRng(seed),
      });
      const weak = resolvePunt({
        punter: makePunter({ puntingPower: 20, puntingAccuracy: 20 }),
        returner: makeReturner(),
        coverageUnit: makeCoverageUnit(),
        yardLine: 25,
        rng: createSeededRng(seed),
      });
      strongTotal += strong.netYards;
      weakTotal += weak.netYards;
    }

    assertGreater(strongTotal / trials, weakTotal / trials);
  });

  await t.step("returner attributes gate return yardage", () => {
    let fastReturnYards = 0;
    let slowReturnYards = 0;
    let fastCount = 0;
    let slowCount = 0;
    const trials = 300;

    for (let seed = 1; seed <= trials; seed++) {
      const fast = resolvePunt({
        punter: makePunter(),
        returner: makeReturner({ speed: 99, agility: 99, acceleration: 99 }),
        coverageUnit: makeCoverageUnit(),
        yardLine: 30,
        rng: createSeededRng(seed),
      });
      const slow = resolvePunt({
        punter: makePunter(),
        returner: makeReturner({ speed: 20, agility: 20, acceleration: 20 }),
        coverageUnit: makeCoverageUnit(),
        yardLine: 30,
        rng: createSeededRng(seed),
      });

      if (fast.outcome === "return") {
        fastReturnYards += fast.returnYards ?? 0;
        fastCount++;
      }
      if (slow.outcome === "return") {
        slowReturnYards += slow.returnYards ?? 0;
        slowCount++;
      }
    }

    if (fastCount > 0 && slowCount > 0) {
      assertGreater(fastReturnYards / fastCount, slowReturnYards / slowCount);
    }
  });

  await t.step("coverage unit affects outcomes", () => {
    let goodCoverageFairCatches = 0;
    let badCoverageFairCatches = 0;
    const trials = 300;

    for (let seed = 1; seed <= trials; seed++) {
      const goodCoverage = resolvePunt({
        punter: makePunter(),
        returner: makeReturner(),
        coverageUnit: [
          {
            playerId: "g1",
            neutralBucket: "WR",
            attributes: makeAttributes({ speed: 95, acceleration: 95 }),
          },
          {
            playerId: "g2",
            neutralBucket: "S",
            attributes: makeAttributes({ speed: 95, acceleration: 95 }),
          },
        ],
        yardLine: 30,
        rng: createSeededRng(seed),
      });
      const badCoverage = resolvePunt({
        punter: makePunter(),
        returner: makeReturner(),
        coverageUnit: [
          {
            playerId: "g1",
            neutralBucket: "WR",
            attributes: makeAttributes({ speed: 20, acceleration: 20 }),
          },
          {
            playerId: "g2",
            neutralBucket: "S",
            attributes: makeAttributes({ speed: 20, acceleration: 20 }),
          },
        ],
        yardLine: 30,
        rng: createSeededRng(seed),
      });

      if (goodCoverage.outcome === "fair_catch") goodCoverageFairCatches++;
      if (badCoverage.outcome === "fair_catch") badCoverageFairCatches++;
    }

    assertGreater(goodCoverageFairCatches, badCoverageFairCatches);
  });

  await t.step("blocked punt is tagged correctly", () => {
    let foundBlocked = false;
    for (let seed = 1; seed <= 2000 && !foundBlocked; seed++) {
      const result = resolvePunt({
        punter: makePunter({ puntingPower: 20, puntingAccuracy: 20 }),
        returner: makeReturner(),
        coverageUnit: makeCoverageUnit(),
        yardLine: 30,
        rng: createSeededRng(seed),
      });
      if (result.outcome === "blocked_punt") {
        foundBlocked = true;
        assertEquals(result.netYards, 0);
        assertEquals(result.landingYardLine, 30);
      }
    }
    assertEquals(foundBlocked, true);
  });

  await t.step("muffed punt is tagged correctly", () => {
    let foundMuff = false;
    for (let seed = 1; seed <= 2000 && !foundMuff; seed++) {
      const result = resolvePunt({
        punter: makePunter(),
        returner: makeReturner({ speed: 20, agility: 20 }),
        coverageUnit: makeCoverageUnit(),
        yardLine: 30,
        rng: createSeededRng(seed),
      });
      if (result.outcome === "muffed_punt") {
        foundMuff = true;
        assertEquals(typeof result.landingYardLine, "number");
      }
    }
    assertEquals(foundMuff, true);
  });

  await t.step(
    "touchback sets landing at yard line 80 (20 from endzone)",
    () => {
      let foundTouchback = false;
      for (let seed = 1; seed <= 500 && !foundTouchback; seed++) {
        const result = resolvePunt({
          punter: makePunter({ puntingPower: 99 }),
          returner: makeReturner(),
          coverageUnit: makeCoverageUnit(),
          yardLine: 40,
          rng: createSeededRng(seed),
        });
        if (result.outcome === "touchback") {
          foundTouchback = true;
          assertEquals(result.landingYardLine, 80);
        }
      }
      assertEquals(foundTouchback, true);
    },
  );

  await t.step("downed inside 10 lands within yard lines 90-99", () => {
    let foundDowned = false;
    for (let seed = 1; seed <= 1000 && !foundDowned; seed++) {
      const result = resolvePunt({
        punter: makePunter(),
        returner: makeReturner(),
        coverageUnit: makeCoverageUnit(),
        yardLine: 30,
        rng: createSeededRng(seed),
      });
      if (result.outcome === "downed_inside_10") {
        foundDowned = true;
        assertGreater(result.landingYardLine, 89);
        assertEquals(result.landingYardLine <= 99, true);
      }
    }
    assertEquals(foundDowned, true);
  });

  await t.step("return includes return yards in result", () => {
    let foundReturn = false;
    for (let seed = 1; seed <= 100 && !foundReturn; seed++) {
      const result = resolvePunt({
        punter: makePunter(),
        returner: makeReturner(),
        coverageUnit: makeCoverageUnit(),
        yardLine: 30,
        rng: createSeededRng(seed),
      });
      if (result.outcome === "return") {
        foundReturn = true;
        assertEquals(typeof result.returnYards, "number");
        assertGreater(result.returnYards!, 0);
      }
    }
    assertEquals(foundReturn, true);
  });
});
