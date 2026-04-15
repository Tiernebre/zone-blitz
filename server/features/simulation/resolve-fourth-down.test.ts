import { assertEquals } from "@std/assert";
import {
  type FourthDownDecision,
  type FourthDownInput,
  resolveFourthDown,
} from "./resolve-fourth-down.ts";
import { createSeededRng } from "./rng.ts";

function makeInput(overrides: Partial<FourthDownInput> = {}): FourthDownInput {
  return {
    yardsToEndzone: 60,
    distance: 3,
    scoreDifferential: 0,
    quarter: 2,
    clockSeconds: 450,
    aggressiveness: 50,
    ...overrides,
  };
}

Deno.test("resolveFourthDown", async (t) => {
  await t.step("returns a valid decision", () => {
    const rng = createSeededRng(1);
    const decision = resolveFourthDown(makeInput(), rng);
    const valid: FourthDownDecision[] = ["go", "fg", "punt"];
    assertEquals(valid.includes(decision), true);
  });

  await t.step("deterministic with same seed", () => {
    const input = makeInput();
    const d1 = resolveFourthDown(input, createSeededRng(42));
    const d2 = resolveFourthDown(input, createSeededRng(42));
    assertEquals(d1, d2);
  });

  await t.step("deep in own territory favors punt over go", () => {
    const input = makeInput({
      yardsToEndzone: 80,
      distance: 8,
      aggressiveness: 50,
    });
    let goCount = 0;
    let puntCount = 0;
    for (let seed = 0; seed < 500; seed++) {
      const d = resolveFourthDown(input, createSeededRng(seed));
      if (d === "go") goCount++;
      if (d === "punt") puntCount++;
    }
    assertEquals(
      puntCount > goCount,
      true,
      `Expected more punts than go-for-it from own deep (punts=${puntCount}, go=${goCount})`,
    );
  });

  await t.step("short distance near midfield favors go", () => {
    const input = makeInput({
      yardsToEndzone: 45,
      distance: 1,
      aggressiveness: 50,
    });
    let goCount = 0;
    for (let seed = 0; seed < 500; seed++) {
      const d = resolveFourthDown(input, createSeededRng(seed));
      if (d === "go") goCount++;
    }
    assertEquals(
      goCount > 250,
      true,
      `Expected majority go-for-it on 4th-and-1 near midfield (go=${goCount}/500)`,
    );
  });

  await t.step("FG range produces field goal decisions", () => {
    const input = makeInput({
      yardsToEndzone: 25,
      distance: 8,
      aggressiveness: 50,
    });
    let fgCount = 0;
    for (let seed = 0; seed < 500; seed++) {
      const d = resolveFourthDown(input, createSeededRng(seed));
      if (d === "fg") fgCount++;
    }
    assertEquals(
      fgCount > 100,
      true,
      `Expected some FG decisions in FG range (fg=${fgCount}/500)`,
    );
  });

  await t.step("too far for FG never returns fg", () => {
    const input = makeInput({
      yardsToEndzone: 60,
      distance: 5,
      aggressiveness: 50,
    });
    for (let seed = 0; seed < 200; seed++) {
      const d = resolveFourthDown(input, createSeededRng(seed));
      assertEquals(d !== "fg", true, "Should not attempt FG from 77 yards");
    }
  });

  await t.step("higher aggressiveness increases go-for-it rate", () => {
    const base = {
      yardsToEndzone: 50,
      distance: 3,
      scoreDifferential: 0,
      quarter: 2 as const,
      clockSeconds: 450,
    };
    let conservativeGo = 0;
    let aggressiveGo = 0;
    for (let seed = 0; seed < 1000; seed++) {
      const c = resolveFourthDown(
        { ...base, aggressiveness: 20 },
        createSeededRng(seed),
      );
      const a = resolveFourthDown(
        { ...base, aggressiveness: 80 },
        createSeededRng(seed),
      );
      if (c === "go") conservativeGo++;
      if (a === "go") aggressiveGo++;
    }
    assertEquals(
      aggressiveGo > conservativeGo,
      true,
      `Aggressive coach should go more often (aggressive=${aggressiveGo}, conservative=${conservativeGo})`,
    );
  });

  await t.step("4th-and-goal produces well-defined outcome", () => {
    for (const dist of [1, 2, 3, 5, 8]) {
      const input = makeInput({
        yardsToEndzone: dist,
        distance: dist,
        aggressiveness: 50,
      });
      for (let seed = 0; seed < 50; seed++) {
        const d = resolveFourthDown(input, createSeededRng(seed));
        const valid: FourthDownDecision[] = ["go", "fg", "punt"];
        assertEquals(
          valid.includes(d),
          true,
          `4th-and-goal from ${dist}: got invalid decision "${d}"`,
        );
      }
    }
  });

  await t.step("4th-and-goal from 1 heavily favors go", () => {
    const input = makeInput({
      yardsToEndzone: 1,
      distance: 1,
      aggressiveness: 50,
    });
    let goCount = 0;
    for (let seed = 0; seed < 500; seed++) {
      const d = resolveFourthDown(input, createSeededRng(seed));
      if (d === "go") goCount++;
    }
    assertEquals(
      goCount > 300,
      true,
      `Expected strong go-for-it rate on 4th-and-goal from 1 (go=${goCount}/500)`,
    );
  });

  await t.step("trailing late in game increases go-for-it rate", () => {
    const base = { yardsToEndzone: 45, distance: 4, aggressiveness: 50 };
    let normalGo = 0;
    let desperateGo = 0;
    for (let seed = 0; seed < 1000; seed++) {
      const n = resolveFourthDown({
        ...base,
        scoreDifferential: 0,
        quarter: 2,
        clockSeconds: 450,
      }, createSeededRng(seed));
      const d = resolveFourthDown({
        ...base,
        scoreDifferential: -14,
        quarter: 4,
        clockSeconds: 120,
      }, createSeededRng(seed));
      if (n === "go") normalGo++;
      if (d === "go") desperateGo++;
    }
    assertEquals(
      desperateGo > normalGo,
      true,
      `Trailing team should go more often (desperate=${desperateGo}, normal=${normalGo})`,
    );
  });

  await t.step(
    "overall go-for-it rate across varied situations lands near NFL average",
    () => {
      let totalPlays = 0;
      let goPlays = 0;
      const rng = createSeededRng(999);
      for (let i = 0; i < 5000; i++) {
        const yardsToEndzone = rng.int(1, 99);
        const distance = rng.int(1, 15);
        const scoreDiff = rng.int(-21, 21);
        const quarter = (rng.int(1, 4)) as 1 | 2 | 3 | 4;
        const clock = rng.int(0, 900);
        const aggr = rng.int(30, 70);
        const decision = resolveFourthDown({
          yardsToEndzone,
          distance,
          scoreDifferential: scoreDiff,
          quarter,
          clockSeconds: clock,
          aggressiveness: aggr,
        }, createSeededRng(i));
        totalPlays++;
        if (decision === "go") goPlays++;
      }
      const rate = goPlays / totalPlays;
      assertEquals(
        rate > 0.08 && rate < 0.40,
        true,
        `Overall go-for-it rate ${
          (rate * 100).toFixed(1)
        }% should be in plausible range (8-40%)`,
      );
    },
  );
});
