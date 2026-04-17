import { assert, assertEquals } from "@std/assert";
import {
  PLAYER_ATTRIBUTE_KEYS,
  type PlayerAttributes,
} from "@zone-blitz/shared";
import { createRng, mulberry32 } from "./rng.ts";
import type { SeededRng } from "./rng.ts";
import type {
  MatchupContribution,
  PlayerRuntime,
  Situation,
} from "./resolve-play.ts";
import { synthesizeRunOutcome } from "./synthesize-run-outcome.ts";
import { RUN_COEFFICIENTS } from "./outcome-coefficients.ts";

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

function makePlayer(
  id: string,
  bucket: PlayerRuntime["neutralBucket"],
  overrides: Partial<PlayerAttributes> = {},
): PlayerRuntime {
  return {
    playerId: id,
    neutralBucket: bucket,
    attributes: makeAttributes(overrides),
  };
}

function makeSituation(overrides: Partial<Situation> = {}): Situation {
  return { down: 1, distance: 10, yardLine: 30, ...overrides };
}

function makeRng(seed = 42): SeededRng {
  return createRng(mulberry32(seed));
}

function runTrials(score: number, trials: number): number[] {
  const yards: number[] = [];
  for (let i = 0; i < trials; i++) {
    const rng = makeRng(i);
    const contribs: MatchupContribution[] = [
      {
        matchup: {
          type: "run_block",
          attacker: makePlayer("ot1", "OT"),
          defender: makePlayer("idl1", "IDL"),
        },
        attackerFit: "neutral",
        defenderFit: "neutral",
        score,
      },
    ];
    yards.push(synthesizeRunOutcome(contribs, makeSituation(), rng).yardage);
  }
  return yards;
}

Deno.test("synthesizeRunOutcome", async (t) => {
  await t.step(
    "expected yardage increases with blockScore (monotonic)",
    () => {
      const trials = 300;
      const lowMean = runTrials(-20, trials).reduce((a, b) => a + b, 0) /
        trials;
      const midMean = runTrials(0, trials).reduce((a, b) => a + b, 0) / trials;
      const highMean = runTrials(20, trials).reduce((a, b) => a + b, 0) /
        trials;
      assert(lowMean < midMean, `lowMean=${lowMean} midMean=${midMean}`);
      assert(midMean < highMean, `midMean=${midMean} highMean=${highMean}`);
    },
  );

  await t.step(
    "returns positive yardage most of the time on dominant blocking",
    () => {
      const yards = runTrials(20, 200);
      const positive = yards.filter((y) => y > 0).length;
      assert(positive / yards.length > 0.85, `positive rate=${positive / 200}`);
    },
  );

  await t.step("yardage is clamped to the configured range", () => {
    const extreme = runTrials(100, 100).concat(runTrials(-100, 100));
    for (const y of extreme) {
      assert(y >= RUN_COEFFICIENTS.yardageMin, `${y} < yardageMin`);
      assert(y <= RUN_COEFFICIENTS.yardageMax, `${y} > yardageMax`);
    }
  });

  await t.step(
    "tags big_play when yardage clears the cutoff",
    () => {
      const yards = runTrials(20, 200);
      const bigCount = yards.filter(
        (y) => y >= RUN_COEFFICIENTS.bigPlayCutoff,
      ).length;
      assert(bigCount > 0);

      // Tag must fire on every yardage ≥ cutoff — check one concrete sample.
      for (let i = 0; i < 200; i++) {
        const rng = makeRng(i);
        const contribs: MatchupContribution[] = [
          {
            matchup: {
              type: "run_block",
              attacker: makePlayer("ot1", "OT"),
              defender: makePlayer("idl1", "IDL"),
            },
            attackerFit: "neutral",
            defenderFit: "neutral",
            score: 20,
          },
        ];
        const result = synthesizeRunOutcome(contribs, makeSituation(), rng);
        if (result.yardage >= RUN_COEFFICIENTS.bigPlayCutoff) {
          assertEquals(result.tags.includes("big_play"), true);
          return;
        }
      }
      throw new Error(
        "no big_play observed in 200 trials — cutoff unreachable?",
      );
    },
  );

  await t.step("can produce fumble outcome", () => {
    let fumbleFound = false;
    for (let seed = 0; seed < 5000; seed++) {
      const rng = makeRng(seed);
      const contribs: MatchupContribution[] = [
        {
          matchup: {
            type: "run_block",
            attacker: makePlayer("rb1", "RB"),
            defender: makePlayer("lb1", "LB"),
          },
          attackerFit: "neutral",
          defenderFit: "neutral",
          score: 5,
        },
      ];
      const result = synthesizeRunOutcome(contribs, makeSituation(), rng);
      if (result.outcome === "fumble") {
        assertEquals(result.tags.includes("fumble"), true);
        assertEquals(result.tags.includes("turnover"), true);
        fumbleFound = true;
        break;
      }
    }
    assertEquals(fumbleFound, true);
  });

  await t.step("tags first_down when yardage meets distance", () => {
    let found = false;
    for (let seed = 0; seed < 50; seed++) {
      const rng = makeRng(seed);
      const contribs: MatchupContribution[] = [
        {
          matchup: {
            type: "run_block",
            attacker: makePlayer("ot1", "OT"),
            defender: makePlayer("idl1", "IDL"),
          },
          attackerFit: "neutral",
          defenderFit: "neutral",
          score: 10,
        },
      ];
      const result = synthesizeRunOutcome(
        contribs,
        makeSituation({ down: 1, distance: 3 }),
        rng,
      );
      if (result.yardage >= 3) {
        assertEquals(result.tags.includes("first_down"), true);
        found = true;
        break;
      }
    }
    assertEquals(found, true);
  });

  await t.step("tags RB as ball_carrier", () => {
    const rng = makeRng(42);
    const contribs: MatchupContribution[] = [
      {
        matchup: {
          type: "run_block",
          attacker: makePlayer("rb1", "RB"),
          defender: makePlayer("lb1", "LB"),
        },
        attackerFit: "neutral",
        defenderFit: "neutral",
        score: 5,
      },
    ];
    const result = synthesizeRunOutcome(contribs, makeSituation(), rng);
    const rb = result.participants.find((p) => p.playerId === "rb1");
    assertEquals(rb?.tags.includes("ball_carrier"), true);
  });

  await t.step("handles empty contributions gracefully", () => {
    const rng = makeRng(42);
    const result = synthesizeRunOutcome([], makeSituation(), rng);
    assertEquals(typeof result.outcome, "string");
    assertEquals(typeof result.yardage, "number");
  });

  await t.step(
    "uses run_block and run_defense contributions for blocking score",
    () => {
      const rng = makeRng(42);
      const contribs: MatchupContribution[] = [
        {
          matchup: {
            type: "run_block",
            attacker: makePlayer("ot1", "OT"),
            defender: makePlayer("idl1", "IDL"),
          },
          attackerFit: "neutral",
          defenderFit: "neutral",
          score: 20,
        },
        {
          matchup: {
            type: "run_defense",
            attacker: makePlayer("lb1", "LB"),
            defender: makePlayer("rb1", "RB"),
          },
          attackerFit: "neutral",
          defenderFit: "neutral",
          score: 20,
        },
      ];
      const result = synthesizeRunOutcome(contribs, makeSituation(), rng);
      assertEquals(typeof result.yardage, "number");
    },
  );
});
