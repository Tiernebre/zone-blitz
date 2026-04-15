import { assertEquals, assertGreater } from "@std/assert";
import {
  PLAYER_ATTRIBUTE_KEYS,
  type PlayerAttributes,
} from "@zone-blitz/shared";
import type { PlayerRuntime } from "./resolve-play.ts";
import { createSeededRng } from "./rng.ts";
import { type KickoffContext, resolveKickoff } from "./resolve-kickoff.ts";

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

function makeKickoffContext(
  overrides: Partial<KickoffContext> = {},
): KickoffContext {
  return {
    gameId: "test-game",
    driveIndex: 0,
    playIndex: 0,
    quarter: 1,
    clock: "15:00",
    kickingTeamId: "team-a",
    receivingTeamId: "team-b",
    kicker: makePlayer("k1", "K", { kickingPower: 70 }),
    returner: makePlayer("ret1", "WR", {
      speed: 80,
      elusiveness: 70,
      ballCarrying: 65,
    }),
    coverageUnit: [
      makePlayer("cov1", "LB", { speed: 60, tackling: 70 }),
      makePlayer("cov2", "S", { speed: 70, tackling: 65 }),
    ],
    scoreDifferential: 0,
    ...overrides,
  };
}

Deno.test("resolveKickoff", async (t) => {
  await t.step("returns a PlayEvent with outcome kickoff", () => {
    const rng = createSeededRng(42);
    const ctx = makeKickoffContext();
    const result = resolveKickoff(ctx, rng);

    assertEquals(result.event.outcome, "kickoff");
    assertEquals(result.event.gameId, "test-game");
    assertEquals(result.event.offenseTeamId, "team-a");
    assertEquals(result.event.defenseTeamId, "team-b");
    assertEquals(result.event.call.concept, "kickoff");
    assertEquals(result.event.call.personnel, "special_teams");
    assertEquals(result.event.coverage.front, "kick_return");
  });

  await t.step(
    "starting yard line is between 1 and 99 for non-TD results",
    () => {
      for (let seed = 1; seed <= 100; seed++) {
        const rng = createSeededRng(seed);
        const ctx = makeKickoffContext();
        const result = resolveKickoff(ctx, rng);
        if (!result.isReturnTouchdown) {
          assertGreater(result.startingYardLine, 0);
          assertEquals(result.startingYardLine <= 99, true);
        }
      }
    },
  );

  await t.step("touchback yields yard line 25", () => {
    let foundTouchback = false;
    for (let seed = 1; seed <= 200; seed++) {
      const rng = createSeededRng(seed);
      const ctx = makeKickoffContext({
        kicker: makePlayer("k1", "K", { kickingPower: 99 }),
      });
      const result = resolveKickoff(ctx, rng);
      if (
        result.startingYardLine === 25 &&
        !result.isOnsideRecovery &&
        !result.isReturnTouchdown
      ) {
        foundTouchback = true;
        break;
      }
    }
    assertEquals(foundTouchback, true);
  });

  await t.step("return produces variable starting yard line", () => {
    const yardLines = new Set<number>();
    for (let seed = 1; seed <= 200; seed++) {
      const rng = createSeededRng(seed);
      const ctx = makeKickoffContext();
      const result = resolveKickoff(ctx, rng);
      if (!result.isOnsideRecovery && !result.isReturnTouchdown) {
        yardLines.add(result.startingYardLine);
      }
    }
    assertGreater(yardLines.size, 3);
  });

  await t.step("out-of-bounds yields yard line 40", () => {
    let foundOOB = false;
    for (let seed = 1; seed <= 500; seed++) {
      const rng = createSeededRng(seed);
      const ctx = makeKickoffContext();
      const result = resolveKickoff(ctx, rng);
      if (result.startingYardLine === 40 && !result.isOnsideRecovery) {
        foundOOB = true;
        break;
      }
    }
    assertEquals(foundOOB, true);
  });

  await t.step("kicker with high power produces more touchbacks", () => {
    let strongTouchbacks = 0;
    let weakTouchbacks = 0;
    const trials = 500;

    for (let seed = 1; seed <= trials; seed++) {
      const rngStrong = createSeededRng(seed);
      const ctxStrong = makeKickoffContext({
        kicker: makePlayer("k1", "K", { kickingPower: 95 }),
      });
      const strongResult = resolveKickoff(ctxStrong, rngStrong);
      if (
        strongResult.startingYardLine === 25 && !strongResult.isOnsideRecovery
      ) {
        strongTouchbacks++;
      }

      const rngWeak = createSeededRng(seed + 10000);
      const ctxWeak = makeKickoffContext({
        kicker: makePlayer("k1", "K", { kickingPower: 30 }),
      });
      const weakResult = resolveKickoff(ctxWeak, rngWeak);
      if (weakResult.startingYardLine === 25 && !weakResult.isOnsideRecovery) {
        weakTouchbacks++;
      }
    }

    assertGreater(strongTouchbacks, weakTouchbacks);
  });

  await t.step("onside kick only attempted when trailing late", () => {
    let onsideFound = false;
    for (let seed = 1; seed <= 300; seed++) {
      const rng = createSeededRng(seed);
      const ctx = makeKickoffContext({
        scoreDifferential: 0,
        quarter: 1,
        clock: "15:00",
      });
      const result = resolveKickoff(ctx, rng);
      if (result.event.tags.includes("onside")) {
        onsideFound = true;
      }
    }
    assertEquals(onsideFound, false);
  });

  await t.step(
    "trailing team in Q4 final minutes can elect onside kick",
    () => {
      let onsideFound = false;
      for (let seed = 1; seed <= 500; seed++) {
        const rng = createSeededRng(seed);
        const ctx = makeKickoffContext({
          scoreDifferential: -10,
          quarter: 4,
          clock: "4:30",
        });
        const result = resolveKickoff(ctx, rng);
        if (result.event.tags.includes("onside")) {
          onsideFound = true;
          break;
        }
      }
      assertEquals(onsideFound, true);
    },
  );

  await t.step("onside recovery rate is within NFL-realistic range", () => {
    let onsideAttempts = 0;
    let onsideRecoveries = 0;
    const trials = 2000;

    for (let seed = 1; seed <= trials; seed++) {
      const rng = createSeededRng(seed);
      const ctx = makeKickoffContext({
        scoreDifferential: -10,
        quarter: 4,
        clock: "2:00",
      });
      const result = resolveKickoff(ctx, rng);
      if (result.event.tags.includes("onside")) {
        onsideAttempts++;
        if (result.isOnsideRecovery) {
          onsideRecoveries++;
        }
      }
    }

    assertGreater(onsideAttempts, 0);
    const recoveryRate = onsideRecoveries / onsideAttempts;
    assertGreater(recoveryRate, 0.05);
    assertEquals(recoveryRate < 0.25, true);
  });

  await t.step(
    "onside recovery gives kicking team ball around midfield",
    () => {
      let foundRecovery = false;
      for (let seed = 1; seed <= 2000; seed++) {
        const rng = createSeededRng(seed);
        const ctx = makeKickoffContext({
          scoreDifferential: -10,
          quarter: 4,
          clock: "2:00",
        });
        const result = resolveKickoff(ctx, rng);
        if (result.isOnsideRecovery) {
          foundRecovery = true;
          assertGreater(result.startingYardLine, 0);
          assertEquals(result.startingYardLine <= 60, true);
          break;
        }
      }
      assertEquals(foundRecovery, true);
    },
  );

  await t.step("return TD sets isReturnTouchdown flag", () => {
    let foundReturnTD = false;
    for (let seed = 1; seed <= 5000; seed++) {
      const rng = createSeededRng(seed);
      const ctx = makeKickoffContext({
        returner: makePlayer("ret1", "WR", {
          speed: 99,
          elusiveness: 99,
          ballCarrying: 99,
        }),
      });
      const result = resolveKickoff(ctx, rng);
      if (result.isReturnTouchdown) {
        foundReturnTD = true;
        assertEquals(result.event.tags.includes("touchdown"), true);
        break;
      }
    }
    assertEquals(foundReturnTD, true);
  });

  await t.step("kicker is tagged as participant", () => {
    const rng = createSeededRng(42);
    const ctx = makeKickoffContext();
    const result = resolveKickoff(ctx, rng);

    const kickerParticipant = result.event.participants.find(
      (p) => p.role === "kicker",
    );
    assertEquals(kickerParticipant?.playerId, "k1");
  });

  await t.step("returner is tagged as participant on returns", () => {
    let foundReturn = false;
    for (let seed = 1; seed <= 100; seed++) {
      const rng = createSeededRng(seed);
      const ctx = makeKickoffContext();
      const result = resolveKickoff(ctx, rng);
      if (
        !result.isOnsideRecovery &&
        result.startingYardLine !== 25 &&
        result.startingYardLine !== 40
      ) {
        foundReturn = true;
        const returnerParticipant = result.event.participants.find(
          (p) => p.role === "returner",
        );
        assertEquals(returnerParticipant?.playerId, "ret1");
        break;
      }
    }
    assertEquals(foundReturn, true);
  });

  await t.step("determinism: same seed produces identical result", () => {
    const ctx = makeKickoffContext();

    const rng1 = createSeededRng(42);
    const result1 = resolveKickoff(ctx, rng1);

    const rng2 = createSeededRng(42);
    const result2 = resolveKickoff(ctx, rng2);

    assertEquals(result1.event, result2.event);
    assertEquals(result1.startingYardLine, result2.startingYardLine);
    assertEquals(result1.isOnsideRecovery, result2.isOnsideRecovery);
    assertEquals(result1.isReturnTouchdown, result2.isReturnTouchdown);
  });

  await t.step("situation reflects kickoff position", () => {
    const rng = createSeededRng(42);
    const ctx = makeKickoffContext();
    const result = resolveKickoff(ctx, rng);

    assertEquals(result.event.situation.down, 1);
    assertEquals(result.event.situation.distance, 10);
    assertEquals(result.event.situation.yardLine, 35);
  });
});
