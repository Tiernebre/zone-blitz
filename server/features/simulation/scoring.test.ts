import { assertEquals } from "@std/assert";
import {
  PLAYER_ATTRIBUTE_KEYS,
  type PlayerAttributes,
  type SchemeFingerprint,
} from "@zone-blitz/shared";
import { createRng, mulberry32 } from "./rng.ts";
import type { SeededRng } from "./rng.ts";
import type {
  CoachingMods,
  GameState,
  PlayerRuntime,
  TeamRuntime,
} from "./resolve-play.ts";
import type { PlayEvent } from "./events.ts";
import {
  conversionDecision,
  detectSafety,
  findKicker,
  findTurnoverDefender,
  resolveExtraPoint,
  resolveReturnTd,
  resolveTwoPointConversion,
} from "./scoring.ts";

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

function makeRng(seed = 42): SeededRng {
  return createRng(mulberry32(seed));
}

function makeFingerprint(): SchemeFingerprint {
  return {
    offense: {
      runPassLean: 50,
      tempo: 50,
      personnelWeight: 50,
      formationUnderCenterShotgun: 50,
      preSnapMotionRate: 50,
      passingStyle: 50,
      passingDepth: 50,
      runGameBlocking: 50,
      rpoIntegration: 50,
    },
    defense: {
      frontOddEven: 50,
      gapResponsibility: 50,
      subPackageLean: 50,
      coverageManZone: 50,
      coverageShell: 50,
      cornerPressOff: 50,
      pressureRate: 50,
      disguiseRate: 50,
    },
    overrides: {},
  };
}

function makeCoachingMods(): CoachingMods {
  return { schemeFitBonus: 0, situationalBonus: 0 };
}

function makeOffense(): PlayerRuntime[] {
  return [
    makePlayer("qb1", "QB"),
    makePlayer("rb1", "RB"),
    makePlayer("wr1", "WR"),
    makePlayer("wr2", "WR"),
    makePlayer("te1", "TE"),
    makePlayer("ot1", "OT"),
    makePlayer("ot2", "OT"),
    makePlayer("iol1", "IOL"),
    makePlayer("iol2", "IOL"),
    makePlayer("iol3", "IOL"),
  ];
}

function makeDefense(): PlayerRuntime[] {
  return [
    makePlayer("edge1", "EDGE"),
    makePlayer("edge2", "EDGE"),
    makePlayer("idl1", "IDL"),
    makePlayer("idl2", "IDL"),
    makePlayer("lb1", "LB"),
    makePlayer("lb2", "LB"),
    makePlayer("cb1", "CB"),
    makePlayer("cb2", "CB"),
    makePlayer("s1", "S"),
    makePlayer("s2", "S"),
  ];
}

function makeGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    gameId: "game-1",
    driveIndex: 0,
    playIndex: 0,
    quarter: 1,
    clock: "15:00",
    situation: { down: 1, distance: 10, yardLine: 30 },
    offenseTeamId: "team-a",
    defenseTeamId: "team-b",
    ...overrides,
  };
}

function makeTeamRuntime(
  overrides: Partial<TeamRuntime> & { onField?: PlayerRuntime[] } = {},
): TeamRuntime {
  return {
    fingerprint: makeFingerprint(),
    onField: makeOffense(),
    coachingMods: makeCoachingMods(),
    ...overrides,
  };
}

// ── conversionDecision ─────────────────────────────────────────────

Deno.test("conversionDecision", async (t) => {
  await t.step("defaults to XP with neutral aggressiveness", () => {
    assertEquals(conversionDecision(0, 1, "15:00", 50), "xp");
  });

  await t.step("goes for 2 when down 2 in Q4", () => {
    assertEquals(conversionDecision(-2, 4, "5:00", 50), "two_point");
  });

  await t.step("goes for 2 when down 8 in any quarter", () => {
    assertEquals(conversionDecision(-8, 1, "15:00", 50), "two_point");
    assertEquals(conversionDecision(-8, 4, "2:00", 50), "two_point");
  });

  await t.step("goes for 2 when down 15 in Q3+", () => {
    assertEquals(conversionDecision(-15, 3, "10:00", 50), "two_point");
    assertEquals(conversionDecision(-15, 4, "5:00", 50), "two_point");
  });

  await t.step("does not go for 2 when down 15 in Q1", () => {
    assertEquals(conversionDecision(-15, 1, "12:00", 50), "xp");
  });

  await t.step("aggressive coach goes for 2 in Q4", () => {
    assertEquals(conversionDecision(0, 4, "10:00", 85), "two_point");
  });

  await t.step(
    "aggressive coach still kicks XP early unless threshold met",
    () => {
      assertEquals(conversionDecision(0, 1, "15:00", 85), "xp");
    },
  );

  await t.step("very aggressive coach goes for 2 even early", () => {
    assertEquals(conversionDecision(0, 1, "15:00", 95), "two_point");
  });

  await t.step("2PT rate across sweep lands in NFL bands (5-10%)", () => {
    let twoPtCount = 0;
    const total = 1000;
    for (let i = 0; i < total; i++) {
      const quarter = ((i % 4) + 1) as 1 | 2 | 3 | 4;
      const diff = (i % 21) - 10;
      const aggressiveness = 40 + (i % 30);
      const choice = conversionDecision(diff, quarter, "8:00", aggressiveness);
      if (choice === "two_point") twoPtCount++;
    }
    const rate = twoPtCount / total;
    assertEquals(
      rate >= 0.03 && rate <= 0.15,
      true,
      `2PT rate ${rate} outside NFL bands`,
    );
  });
});

// ── resolveExtraPoint ──────────────────────────────────────────────

Deno.test("resolveExtraPoint", async (t) => {
  await t.step("high-accuracy kicker makes XP at high rate", () => {
    const kicker = makePlayer("k1", "K", { kickingAccuracy: 85 });
    let made = 0;
    const total = 200;
    for (let i = 0; i < total; i++) {
      if (resolveExtraPoint(kicker, makeRng(i))) made++;
    }
    assertEquals(
      made / total > 0.90,
      true,
      `XP rate ${made / total} too low for elite kicker`,
    );
  });

  await t.step("low-accuracy kicker misses more often", () => {
    const kicker = makePlayer("k1", "K", { kickingAccuracy: 30 });
    let missed = 0;
    const total = 500;
    for (let i = 0; i < total; i++) {
      if (!resolveExtraPoint(kicker, makeRng(i))) missed++;
    }
    assertEquals(missed > 0, true, "Low-accuracy kicker should miss some XPs");
  });

  await t.step("handles undefined kicker gracefully", () => {
    const rng = makeRng();
    const result = resolveExtraPoint(undefined, rng);
    assertEquals(typeof result, "boolean");
  });

  await t.step(
    "XP success rate in NFL range (~88-98%) for average kicker",
    () => {
      const kicker = makePlayer("k1", "K", { kickingAccuracy: 50 });
      let made = 0;
      const total = 1000;
      for (let i = 0; i < total; i++) {
        if (resolveExtraPoint(kicker, makeRng(i))) made++;
      }
      const rate = made / total;
      assertEquals(
        rate >= 0.85 && rate <= 0.99,
        true,
        `XP rate ${rate} outside range`,
      );
    },
  );
});

// ── resolveTwoPointConversion ──────────────────────────────────────

Deno.test("resolveTwoPointConversion", async (t) => {
  await t.step("returns a PlayEvent with outcome two_point", () => {
    const rng = makeRng();
    const state = makeGameState();
    const offense = makeTeamRuntime({ onField: makeOffense() });
    const defense = makeTeamRuntime({ onField: makeDefense() });

    const event = resolveTwoPointConversion(state, offense, defense, rng);
    assertEquals(event.outcome, "two_point");
  });

  await t.step("successful conversion has two_point_conversion tag", () => {
    let foundSuccess = false;
    for (let seed = 0; seed < 200 && !foundSuccess; seed++) {
      const rng = makeRng(seed);
      const state = makeGameState();
      const offense = makeTeamRuntime({ onField: makeOffense() });
      const defense = makeTeamRuntime({ onField: makeDefense() });

      const event = resolveTwoPointConversion(state, offense, defense, rng);
      if (event.tags.includes("two_point_conversion")) {
        foundSuccess = true;
        assertEquals(event.outcome, "two_point");
      }
    }
    assertEquals(foundSuccess, true, "Should find at least one successful 2PT");
  });

  await t.step("failed conversion does not have touchdown tag", () => {
    for (let seed = 0; seed < 100; seed++) {
      const rng = makeRng(seed);
      const state = makeGameState();
      const offense = makeTeamRuntime({ onField: makeOffense() });
      const defense = makeTeamRuntime({ onField: makeDefense() });

      const event = resolveTwoPointConversion(state, offense, defense, rng);
      assertEquals(event.tags.includes("touchdown"), false);
    }
  });

  await t.step(
    "2PT conversion rate in NFL range (~45-55%) over many seeds",
    () => {
      let success = 0;
      const total = 500;
      for (let seed = 0; seed < total; seed++) {
        const rng = makeRng(seed);
        const state = makeGameState();
        const offense = makeTeamRuntime({ onField: makeOffense() });
        const defense = makeTeamRuntime({ onField: makeDefense() });

        const event = resolveTwoPointConversion(state, offense, defense, rng);
        if (event.tags.includes("two_point_conversion")) success++;
      }
      const rate = success / total;
      assertEquals(
        rate >= 0.20 && rate <= 0.70,
        true,
        `2PT success rate ${rate} outside bounds`,
      );
    },
  );
});

// ── detectSafety ───────────────────────────────────────────────────

Deno.test("detectSafety", async (t) => {
  await t.step("sack at the 2-yard line into end zone is a safety", () => {
    assertEquals(detectSafety(-5, 2, "sack"), true);
  });

  await t.step(
    "tackle at the 1-yard line for loss into end zone is a safety",
    () => {
      assertEquals(detectSafety(-3, 1, "rush"), true);
    },
  );

  await t.step("normal play at mid-field is not a safety", () => {
    assertEquals(detectSafety(-2, 30, "sack"), false);
  });

  await t.step("play at own 5 with small loss is not a safety", () => {
    assertEquals(detectSafety(-3, 5, "rush"), false);
  });

  await t.step("play exactly at goal line (result = 0) is a safety", () => {
    assertEquals(detectSafety(-3, 3, "rush"), true);
  });

  await t.step("field goal is never a safety", () => {
    assertEquals(detectSafety(-5, 2, "field_goal"), false);
  });

  await t.step("punt is never a safety", () => {
    assertEquals(detectSafety(-5, 2, "punt"), false);
  });
});

// ── resolveReturnTd ────────────────────────────────────────────────

Deno.test("resolveReturnTd", async (t) => {
  await t.step("fast defender has higher return TD chance", () => {
    const fastDefender = makePlayer("cb1", "CB", {
      speed: 90,
      acceleration: 88,
    });
    let tdCount = 0;
    const total = 1000;
    for (let i = 0; i < total; i++) {
      if (resolveReturnTd(fastDefender, makeRng(i))) tdCount++;
    }
    assertEquals(
      tdCount > 0,
      true,
      "Fast defender should score some return TDs",
    );
    assertEquals(
      tdCount / total <= 0.15,
      true,
      "Return TD rate should not exceed 15%",
    );
  });

  await t.step("slow defender has lower return TD chance", () => {
    const slowDefender = makePlayer("lb1", "LB", {
      speed: 30,
      acceleration: 30,
    });
    let tdCount = 0;
    const total = 1000;
    for (let i = 0; i < total; i++) {
      if (resolveReturnTd(slowDefender, makeRng(i))) tdCount++;
    }
    assertEquals(
      tdCount / total < 0.05,
      true,
      `Slow defender rate ${tdCount / total} too high`,
    );
  });

  await t.step("handles undefined defender", () => {
    const rng = makeRng();
    const result = resolveReturnTd(undefined, rng);
    assertEquals(typeof result, "boolean");
  });

  await t.step("overall return TD rate in NFL range (1-10%)", () => {
    const defender = makePlayer("cb1", "CB", { speed: 50, acceleration: 50 });
    let tdCount = 0;
    const total = 2000;
    for (let i = 0; i < total; i++) {
      if (resolveReturnTd(defender, makeRng(i))) tdCount++;
    }
    const rate = tdCount / total;
    assertEquals(
      rate >= 0.01 && rate <= 0.10,
      true,
      `Return TD rate ${rate} outside range`,
    );
  });
});

// ── findKicker ─────────────────────────────────────────────────────

Deno.test("findKicker", async (t) => {
  await t.step("finds K player in roster", () => {
    const players = [
      makePlayer("qb1", "QB"),
      makePlayer("k1", "K"),
      makePlayer("rb1", "RB"),
    ];
    const kicker = findKicker(players);
    assertEquals(kicker?.playerId, "k1");
  });

  await t.step("returns undefined when no K in roster", () => {
    const players = [makePlayer("qb1", "QB"), makePlayer("rb1", "RB")];
    assertEquals(findKicker(players), undefined);
  });
});

// ── findTurnoverDefender ───────────────────────────────────────────

Deno.test("findTurnoverDefender", async (t) => {
  await t.step("finds interception participant", () => {
    const event = {
      participants: [
        { role: "route_coverage", playerId: "cb1", tags: ["interception"] },
        { role: "pass_protection", playerId: "ot1", tags: [] },
      ],
    } as PlayEvent;
    assertEquals(findTurnoverDefender(event), "cb1");
  });

  await t.step("falls back to defensive participant for fumbles", () => {
    const event = {
      participants: [
        { role: "run_block", playerId: "ot1", tags: [] },
        { role: "run_defense", playerId: "lb1", tags: [] },
      ],
    } as unknown as PlayEvent;
    assertEquals(findTurnoverDefender(event), "lb1");
  });

  await t.step("returns undefined with no defensive participants", () => {
    const event = {
      participants: [
        { role: "ball_carrier", playerId: "rb1", tags: [] },
      ],
    } as unknown as PlayEvent;
    assertEquals(findTurnoverDefender(event), undefined);
  });
});
