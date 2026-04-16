import { assertEquals, assertExists } from "@std/assert";
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
import { synthesizePassOutcome } from "./synthesize-pass-outcome.ts";

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

Deno.test("synthesizePassOutcome", async (t) => {
  await t.step("produces sack on terrible protection", () => {
    let sackCount = 0;
    const trials = 30;
    for (let i = 0; i < trials; i++) {
      const rng = makeRng(i);
      const contribs: MatchupContribution[] = [
        {
          matchup: {
            type: "pass_protection",
            attacker: makePlayer("ot1", "OT"),
            defender: makePlayer("edge1", "EDGE"),
          },
          attackerFit: "neutral",
          defenderFit: "neutral",
          score: -20,
        },
      ];
      const result = synthesizePassOutcome(contribs, makeSituation(), rng);
      if (result.outcome === "sack" || result.outcome === "fumble") {
        sackCount++;
      }
    }
    assertEquals(sackCount / trials > 0.10, true);
  });

  await t.step("tags sack and pressure on sack outcome", () => {
    let sackFound = false;
    for (let seed = 0; seed < 500; seed++) {
      const rng = makeRng(seed);
      const contribs: MatchupContribution[] = [
        {
          matchup: {
            type: "pass_protection",
            attacker: makePlayer("ot1", "OT"),
            defender: makePlayer("edge1", "EDGE"),
          },
          attackerFit: "neutral",
          defenderFit: "neutral",
          score: -20,
        },
      ];
      const result = synthesizePassOutcome(contribs, makeSituation(), rng);
      if (result.outcome === "sack") {
        assertEquals(result.tags.includes("sack"), true);
        assertEquals(result.tags.includes("pressure"), true);
        sackFound = true;
        break;
      }
    }
    assertEquals(sackFound, true);
  });

  await t.step("tags pass rusher with sack participant tag", () => {
    let sackWithRusherFound = false;
    for (let seed = 0; seed < 500; seed++) {
      const rng = makeRng(seed);
      const contribs: MatchupContribution[] = [
        {
          matchup: {
            type: "pass_protection",
            attacker: makePlayer("ot1", "OT"),
            defender: makePlayer("edge1", "EDGE"),
          },
          attackerFit: "neutral",
          defenderFit: "neutral",
          score: -20,
        },
      ];
      const result = synthesizePassOutcome(contribs, makeSituation(), rng);
      if (result.outcome === "sack") {
        const rusher = result.participants.find((p) => p.tags.includes("sack"));
        assertExists(rusher);
        sackWithRusherFound = true;
        break;
      }
    }
    assertEquals(sackWithRusherFound, true);
  });

  await t.step("can produce sack-fumble", () => {
    let fumbleFound = false;
    for (let seed = 0; seed < 5000; seed++) {
      const rng = makeRng(seed);
      const contribs: MatchupContribution[] = [
        {
          matchup: {
            type: "pass_protection",
            attacker: makePlayer("ot1", "OT"),
            defender: makePlayer("edge1", "EDGE"),
          },
          attackerFit: "neutral",
          defenderFit: "neutral",
          score: -20,
        },
      ];
      const result = synthesizePassOutcome(contribs, makeSituation(), rng);
      if (result.outcome === "fumble" && result.tags.includes("sack")) {
        assertEquals(result.tags.includes("turnover"), true);
        fumbleFound = true;
        break;
      }
    }
    assertEquals(fumbleFound, true);
  });

  await t.step("produces interception on terrible coverage", () => {
    let intFound = false;
    for (let seed = 0; seed < 2000; seed++) {
      const rng = makeRng(seed);
      const contribs: MatchupContribution[] = [
        {
          matchup: {
            type: "pass_protection",
            attacker: makePlayer("ot1", "OT"),
            defender: makePlayer("edge1", "EDGE"),
          },
          attackerFit: "neutral",
          defenderFit: "neutral",
          score: 10,
        },
        {
          matchup: {
            type: "route_coverage",
            attacker: makePlayer("wr1", "WR"),
            defender: makePlayer("cb1", "CB"),
          },
          attackerFit: "neutral",
          defenderFit: "neutral",
          score: -20,
        },
      ];
      const result = synthesizePassOutcome(contribs, makeSituation(), rng);
      if (result.outcome === "interception") {
        assertEquals(result.tags.includes("interception"), true);
        assertEquals(result.tags.includes("turnover"), true);
        intFound = true;
        break;
      }
    }
    assertEquals(intFound, true);
  });

  await t.step("tags interceptor participant", () => {
    for (let seed = 0; seed < 2000; seed++) {
      const rng = makeRng(seed);
      const contribs: MatchupContribution[] = [
        {
          matchup: {
            type: "pass_protection",
            attacker: makePlayer("ot1", "OT"),
            defender: makePlayer("edge1", "EDGE"),
          },
          attackerFit: "neutral",
          defenderFit: "neutral",
          score: 10,
        },
        {
          matchup: {
            type: "route_coverage",
            attacker: makePlayer("wr1", "WR"),
            defender: makePlayer("cb1", "CB"),
          },
          attackerFit: "neutral",
          defenderFit: "neutral",
          score: -20,
        },
      ];
      const result = synthesizePassOutcome(contribs, makeSituation(), rng);
      if (result.outcome === "interception") {
        const interceptor = result.participants.find((p) =>
          p.tags.includes("interception")
        );
        assertExists(interceptor);
        break;
      }
    }
  });

  await t.step("produces completions with target/reception tags", () => {
    let completionFound = false;
    for (let seed = 0; seed < 100; seed++) {
      const rng = makeRng(seed);
      const contribs: MatchupContribution[] = [
        {
          matchup: {
            type: "route_coverage",
            attacker: makePlayer("wr1", "WR"),
            defender: makePlayer("cb1", "CB"),
          },
          attackerFit: "neutral",
          defenderFit: "neutral",
          score: 15,
        },
      ];
      const result = synthesizePassOutcome(contribs, makeSituation(), rng);
      if (result.outcome === "pass_complete") {
        const target = result.participants.find((p) =>
          p.tags.includes("target")
        );
        if (target) {
          assertEquals(target.tags.includes("reception"), true);
          completionFound = true;
          break;
        }
      }
    }
    assertEquals(completionFound, true);
  });

  await t.step("produces big_play completions", () => {
    let bigPlayFound = false;
    for (let seed = 0; seed < 200; seed++) {
      const rng = makeRng(seed);
      const contribs: MatchupContribution[] = [
        {
          matchup: {
            type: "route_coverage",
            attacker: makePlayer("wr1", "WR"),
            defender: makePlayer("cb1", "CB"),
          },
          attackerFit: "neutral",
          defenderFit: "neutral",
          score: 15,
        },
      ];
      const result = synthesizePassOutcome(contribs, makeSituation(), rng);
      if (result.tags.includes("big_play")) {
        bigPlayFound = true;
        break;
      }
    }
    assertEquals(bigPlayFound, true);
  });

  await t.step("produces pass_incomplete outcome", () => {
    let incompleteFound = false;
    for (let seed = 0; seed < 100; seed++) {
      const rng = makeRng(seed);
      const contribs: MatchupContribution[] = [
        {
          matchup: {
            type: "route_coverage",
            attacker: makePlayer("wr1", "WR"),
            defender: makePlayer("cb1", "CB"),
          },
          attackerFit: "neutral",
          defenderFit: "neutral",
          score: 0,
        },
      ];
      const result = synthesizePassOutcome(contribs, makeSituation(), rng);
      if (result.outcome === "pass_incomplete") {
        assertEquals(result.yardage, 0);
        incompleteFound = true;
        break;
      }
    }
    assertEquals(incompleteFound, true);
  });

  await t.step("tags first_down on pass completion meeting distance", () => {
    let firstDownFound = false;
    for (let seed = 0; seed < 100; seed++) {
      const rng = makeRng(seed);
      const contribs: MatchupContribution[] = [
        {
          matchup: {
            type: "route_coverage",
            attacker: makePlayer("wr1", "WR"),
            defender: makePlayer("cb1", "CB"),
          },
          attackerFit: "neutral",
          defenderFit: "neutral",
          score: 15,
        },
      ];
      const result = synthesizePassOutcome(
        contribs,
        makeSituation({ down: 1, distance: 5 }),
        rng,
      );
      if (
        result.outcome === "pass_complete" &&
        result.yardage >= 5 &&
        result.tags.includes("first_down")
      ) {
        firstDownFound = true;
        break;
      }
    }
    assertEquals(firstDownFound, true);
  });

  await t.step(
    "tags pressure without sack on negative protection score",
    () => {
      const rng = makeRng(42);
      const contribs: MatchupContribution[] = [
        {
          matchup: {
            type: "pass_protection",
            attacker: makePlayer("ot1", "OT"),
            defender: makePlayer("edge1", "EDGE"),
          },
          attackerFit: "neutral",
          defenderFit: "neutral",
          score: -10,
        },
        {
          matchup: {
            type: "route_coverage",
            attacker: makePlayer("wr1", "WR"),
            defender: makePlayer("cb1", "CB"),
          },
          attackerFit: "neutral",
          defenderFit: "neutral",
          score: 0,
        },
      ];
      const result = synthesizePassOutcome(contribs, makeSituation(), rng);
      assertEquals(result.tags.includes("pressure"), true);
    },
  );

  await t.step("handles empty contributions gracefully", () => {
    const rng = makeRng(42);
    const result = synthesizePassOutcome([], makeSituation(), rng);
    assertEquals(typeof result.outcome, "string");
    assertEquals(typeof result.yardage, "number");
  });
});
