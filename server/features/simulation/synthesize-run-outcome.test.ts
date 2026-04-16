import { assertEquals } from "@std/assert";
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

Deno.test("synthesizeRunOutcome", async (t) => {
  await t.step(
    "returns rush outcome with yardage for dominant blocking",
    () => {
      let positiveCount = 0;
      const trials = 30;
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
            score: 20,
          },
        ];
        const result = synthesizeRunOutcome(contribs, makeSituation(), rng);
        if (result.yardage > 0) positiveCount++;
      }
      assertEquals(positiveCount / trials > 0.9, true);
    },
  );

  await t.step("returns negative yardage for terrible blocking", () => {
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
        score: -25,
      },
    ];
    const result = synthesizeRunOutcome(contribs, makeSituation(), rng);
    assertEquals(result.yardage <= 0, true);
  });

  await t.step(
    "returns moderate yardage for slightly negative blocking",
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
          score: -10,
        },
      ];
      const result = synthesizeRunOutcome(contribs, makeSituation(), rng);
      assertEquals(result.yardage >= 1 && result.yardage <= 5, true);
    },
  );

  await t.step("tags big_play for great blocking", () => {
    let bigPlayFound = false;
    for (let seed = 0; seed < 100; seed++) {
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
          score: 20,
        },
      ];
      const result = synthesizeRunOutcome(contribs, makeSituation(), rng);
      if (result.tags.includes("big_play")) {
        bigPlayFound = true;
        break;
      }
    }
    assertEquals(bigPlayFound, true);
  });

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
    const rng = makeRng(5);
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
    }
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
