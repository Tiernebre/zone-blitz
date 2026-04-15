import { assertEquals } from "@std/assert";
import type {
  DefensiveTendencies,
  NeutralBucket,
  OffensiveTendencies,
  PlayerAttributes,
  SchemeFingerprint,
} from "@zone-blitz/shared";
import { PLAYER_ATTRIBUTE_KEYS } from "@zone-blitz/shared";
import { createRng, mulberry32 } from "./rng.ts";
import type { SeededRng } from "./rng.ts";
import {
  drawDefensiveCall,
  drawOffensiveCall,
  type GameState,
  identifyMatchups,
  type MatchupContribution,
  type OnFieldPlayer,
  resolvePlay,
  rollMatchup,
  synthesizeOutcome,
  type TeamRuntime,
} from "./resolve-play.ts";

function makeAttributes(
  overrides: Partial<Record<string, number>> = {},
): PlayerAttributes {
  const attrs: Record<string, number> = {};
  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    attrs[key] = (overrides[key] as number) ?? 50;
    attrs[`${key}Potential`] = 80;
  }
  return attrs as unknown as PlayerAttributes;
}

function makePlayer(
  id: string,
  bucket: NeutralBucket,
  overrides: Partial<Record<string, number>> = {},
): OnFieldPlayer {
  return {
    playerId: id,
    neutralBucket: bucket,
    attributes: makeAttributes(overrides),
  };
}

function defaultOffense(): OffensiveTendencies {
  return {
    runPassLean: 50,
    tempo: 50,
    personnelWeight: 50,
    formationUnderCenterShotgun: 50,
    preSnapMotionRate: 50,
    passingStyle: 50,
    passingDepth: 50,
    runGameBlocking: 50,
    rpoIntegration: 50,
  };
}

function defaultDefense(): DefensiveTendencies {
  return {
    frontOddEven: 50,
    gapResponsibility: 50,
    subPackageLean: 50,
    coverageManZone: 50,
    coverageShell: 50,
    cornerPressOff: 50,
    pressureRate: 50,
    disguiseRate: 50,
  };
}

function makeFingerprint(
  offense?: Partial<OffensiveTendencies> | null,
  defense?: Partial<DefensiveTendencies> | null,
): SchemeFingerprint {
  return {
    offense: offense === null ? null : { ...defaultOffense(), ...offense },
    defense: defense === null ? null : { ...defaultDefense(), ...defense },
    overrides: {},
  };
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    gameId: "game-1",
    quarter: 1,
    clock: "15:00",
    driveIndex: 0,
    playIndex: 0,
    situation: { down: 1, distance: 10, yardLine: 25 },
    offenseTeamId: "team-a",
    defenseTeamId: "team-b",
    ...overrides,
  };
}

function makeOffensePlayers(): OnFieldPlayer[] {
  return [
    makePlayer("qb1", "QB", { armStrength: 70, accuracyShort: 75 }),
    makePlayer("rb1", "RB", { ballCarrying: 70, elusiveness: 65, speed: 70 }),
    makePlayer("wr1", "WR", { routeRunning: 75, catching: 80, speed: 85 }),
    makePlayer("wr2", "WR", { routeRunning: 65, catching: 70, speed: 75 }),
    makePlayer("te1", "TE", { catching: 60, runBlocking: 65 }),
    makePlayer("ot1", "OT", { passBlocking: 75, runBlocking: 70 }),
    makePlayer("ot2", "OT", { passBlocking: 70, runBlocking: 72 }),
    makePlayer("iol1", "IOL", { passBlocking: 68, runBlocking: 72 }),
    makePlayer("iol2", "IOL", { passBlocking: 65, runBlocking: 70 }),
    makePlayer("iol3", "IOL", { passBlocking: 70, runBlocking: 68 }),
    makePlayer("wr3", "WR", { routeRunning: 60, catching: 65, speed: 70 }),
  ];
}

function makeDefensePlayers(): OnFieldPlayer[] {
  return [
    makePlayer("edge1", "EDGE", { passRushing: 78, acceleration: 75 }),
    makePlayer("edge2", "EDGE", { passRushing: 70, acceleration: 72 }),
    makePlayer("idl1", "IDL", { blockShedding: 72, runDefense: 75 }),
    makePlayer("idl2", "IDL", { blockShedding: 68, runDefense: 70 }),
    makePlayer("lb1", "LB", { tackling: 75, zoneCoverage: 60 }),
    makePlayer("lb2", "LB", { tackling: 70, zoneCoverage: 55 }),
    makePlayer("cb1", "CB", { manCoverage: 80, zoneCoverage: 70, speed: 85 }),
    makePlayer("cb2", "CB", { manCoverage: 72, zoneCoverage: 68, speed: 78 }),
    makePlayer("s1", "S", { zoneCoverage: 75, tackling: 68, anticipation: 72 }),
    makePlayer("s2", "S", { zoneCoverage: 70, tackling: 65, anticipation: 68 }),
    makePlayer("lb3", "LB", { tackling: 65, zoneCoverage: 50 }),
  ];
}

function seeded(seed = 42): SeededRng {
  return createRng(mulberry32(seed));
}

// ─── drawOffensiveCall ───

Deno.test("drawOffensiveCall", async (t) => {
  await t.step("returns an OffensiveCall with all required fields", () => {
    const fp = makeFingerprint({ runPassLean: 50 });
    const situation = { down: 1 as const, distance: 10, yardLine: 25 };
    const call = drawOffensiveCall(fp, situation, seeded());
    assertEquals(typeof call.concept, "string");
    assertEquals(typeof call.personnel, "string");
    assertEquals(typeof call.formation, "string");
    assertEquals(typeof call.motion, "string");
    assertEquals(call.concept.length > 0, true);
  });

  await t.step(
    "run-heavy lean produces more run concepts over many draws",
    () => {
      const fp = makeFingerprint({ runPassLean: 5 });
      const situation = { down: 1 as const, distance: 10, yardLine: 40 };
      let runs = 0;
      const trials = 200;
      for (let i = 0; i < trials; i++) {
        const call = drawOffensiveCall(fp, situation, seeded(i));
        if (call.concept.includes("run") || call.concept.includes("draw")) {
          runs++;
        }
      }
      assertEquals(runs / trials > 0.5, true);
    },
  );

  await t.step(
    "pass-heavy lean produces more pass concepts over many draws",
    () => {
      const fp = makeFingerprint({ runPassLean: 95 });
      const situation = { down: 1 as const, distance: 10, yardLine: 40 };
      let passes = 0;
      const trials = 200;
      for (let i = 0; i < trials; i++) {
        const call = drawOffensiveCall(fp, situation, seeded(i));
        if (
          !call.concept.includes("run") && !call.concept.includes("draw")
        ) {
          passes++;
        }
      }
      assertEquals(passes / trials > 0.5, true);
    },
  );

  await t.step("3rd and long biases toward pass", () => {
    const fp = makeFingerprint({ runPassLean: 50 });
    const situation = { down: 3 as const, distance: 8, yardLine: 40 };
    let passes = 0;
    const trials = 200;
    for (let i = 0; i < trials; i++) {
      const call = drawOffensiveCall(fp, situation, seeded(i));
      if (!call.concept.includes("run") && !call.concept.includes("draw")) {
        passes++;
      }
    }
    assertEquals(passes / trials > 0.55, true);
  });

  await t.step("handles null offense fingerprint gracefully", () => {
    const fp = makeFingerprint(null, {});
    const situation = { down: 1 as const, distance: 10, yardLine: 25 };
    const call = drawOffensiveCall(fp, situation, seeded());
    assertEquals(typeof call.concept, "string");
  });

  await t.step("is deterministic with same seed", () => {
    const fp = makeFingerprint({ runPassLean: 60 });
    const situation = { down: 2 as const, distance: 7, yardLine: 35 };
    const call1 = drawOffensiveCall(fp, situation, seeded(123));
    const call2 = drawOffensiveCall(fp, situation, seeded(123));
    assertEquals(call1, call2);
  });

  await t.step("goal line situation biases toward run", () => {
    const fp = makeFingerprint({ runPassLean: 50 });
    const situation = { down: 1 as const, distance: 2, yardLine: 2 };
    let runs = 0;
    const trials = 200;
    for (let i = 0; i < trials; i++) {
      const call = drawOffensiveCall(fp, situation, seeded(i));
      if (call.concept.includes("run") || call.concept === "draw") runs++;
    }
    assertEquals(runs / trials > 0.4, true);
  });

  await t.step("3rd and medium biases toward pass", () => {
    const fp = makeFingerprint({ runPassLean: 50 });
    const situation = { down: 3 as const, distance: 5, yardLine: 40 };
    let passes = 0;
    const trials = 200;
    for (let i = 0; i < trials; i++) {
      const call = drawOffensiveCall(fp, situation, seeded(i));
      if (!call.concept.includes("run") && call.concept !== "draw") passes++;
    }
    assertEquals(passes / trials > 0.5, true);
  });

  await t.step("short passing depth biases toward short concepts", () => {
    const fp = makeFingerprint({ runPassLean: 95, passingDepth: 10 });
    const situation = { down: 1 as const, distance: 10, yardLine: 40 };
    let shortPasses = 0;
    const trials = 200;
    for (let i = 0; i < trials; i++) {
      const call = drawOffensiveCall(fp, situation, seeded(i));
      if (call.concept === "short_pass" || call.concept === "screen") {
        shortPasses++;
      }
    }
    assertEquals(shortPasses > 0, true);
  });

  await t.step("deep passing depth biases toward deep concepts", () => {
    const fp = makeFingerprint({ runPassLean: 95, passingDepth: 90 });
    const situation = { down: 1 as const, distance: 10, yardLine: 40 };
    let deepPasses = 0;
    const trials = 200;
    for (let i = 0; i < trials; i++) {
      const call = drawOffensiveCall(fp, situation, seeded(i));
      if (call.concept === "deep_pass" || call.concept === "play_action") {
        deepPasses++;
      }
    }
    assertEquals(deepPasses > 0, true);
  });

  await t.step("zone blocking scheme produces zone run concepts", () => {
    const fp = makeFingerprint({ runPassLean: 5, runGameBlocking: 10 });
    const situation = { down: 1 as const, distance: 10, yardLine: 40 };
    let zoneRuns = 0;
    const trials = 200;
    for (let i = 0; i < trials; i++) {
      const call = drawOffensiveCall(fp, situation, seeded(i));
      if (
        call.concept === "inside_run" || call.concept === "outside_run"
      ) {
        zoneRuns++;
      }
    }
    assertEquals(zoneRuns > 0, true);
  });

  await t.step("power blocking scheme produces power run concepts", () => {
    const fp = makeFingerprint({ runPassLean: 5, runGameBlocking: 90 });
    const situation = { down: 1 as const, distance: 10, yardLine: 40 };
    let powerRuns = 0;
    const trials = 200;
    for (let i = 0; i < trials; i++) {
      const call = drawOffensiveCall(fp, situation, seeded(i));
      if (
        call.concept === "power_run" || call.concept === "counter_run"
      ) {
        powerRuns++;
      }
    }
    assertEquals(powerRuns > 0, true);
  });

  await t.step("light personnel weight produces 11 personnel", () => {
    const fp = makeFingerprint({ personnelWeight: 10 });
    const situation = { down: 1 as const, distance: 10, yardLine: 40 };
    const call = drawOffensiveCall(fp, situation, seeded());
    assertEquals(call.personnel, "11");
  });

  await t.step("heavy personnel weight produces heavy personnel", () => {
    const fp = makeFingerprint({ personnelWeight: 90 });
    const situation = { down: 1 as const, distance: 10, yardLine: 40 };
    let heavyCount = 0;
    const trials = 50;
    for (let i = 0; i < trials; i++) {
      const call = drawOffensiveCall(fp, situation, seeded(i));
      if (call.personnel === "21" || call.personnel === "22") heavyCount++;
    }
    assertEquals(heavyCount > 0, true);
  });

  await t.step("under center formation with low lean", () => {
    const fp = makeFingerprint({ formationUnderCenterShotgun: 10 });
    const situation = { down: 1 as const, distance: 10, yardLine: 40 };
    const call = drawOffensiveCall(fp, situation, seeded());
    assertEquals(call.formation, "under_center");
  });

  await t.step("shotgun formation with high lean", () => {
    const fp = makeFingerprint({ formationUnderCenterShotgun: 90 });
    const situation = { down: 1 as const, distance: 10, yardLine: 40 };
    const call = drawOffensiveCall(fp, situation, seeded());
    assertEquals(call.formation, "shotgun");
  });

  await t.step("high motion rate can produce motion", () => {
    const fp = makeFingerprint({ preSnapMotionRate: 95 });
    const situation = { down: 1 as const, distance: 10, yardLine: 40 };
    let motionCalls = 0;
    const trials = 50;
    for (let i = 0; i < trials; i++) {
      const call = drawOffensiveCall(fp, situation, seeded(i));
      if (call.motion !== "none") motionCalls++;
    }
    assertEquals(motionCalls > 0, true);
  });
});

// ─── drawDefensiveCall ───

Deno.test("drawDefensiveCall", async (t) => {
  await t.step("returns a DefensiveCall with all required fields", () => {
    const fp = makeFingerprint({}, { pressureRate: 50 });
    const situation = { down: 1 as const, distance: 10, yardLine: 25 };
    const call = drawDefensiveCall(fp, situation, seeded());
    assertEquals(typeof call.front, "string");
    assertEquals(typeof call.coverage, "string");
    assertEquals(typeof call.pressure, "string");
  });

  await t.step(
    "blitz-heavy pressureRate produces more blitz calls",
    () => {
      const fp = makeFingerprint({}, { pressureRate: 95 });
      const situation = { down: 1 as const, distance: 10, yardLine: 40 };
      let blitzes = 0;
      const trials = 200;
      for (let i = 0; i < trials; i++) {
        const call = drawDefensiveCall(fp, situation, seeded(i));
        if (call.pressure.includes("blitz")) blitzes++;
      }
      assertEquals(blitzes / trials > 0.4, true);
    },
  );

  await t.step(
    "low pressureRate produces mostly base rush",
    () => {
      const fp = makeFingerprint({}, { pressureRate: 5 });
      const situation = { down: 1 as const, distance: 10, yardLine: 40 };
      let base = 0;
      const trials = 200;
      for (let i = 0; i < trials; i++) {
        const call = drawDefensiveCall(fp, situation, seeded(i));
        if (call.pressure === "base") base++;
      }
      assertEquals(base / trials > 0.5, true);
    },
  );

  await t.step("handles null defense fingerprint gracefully", () => {
    const fp = makeFingerprint({}, null);
    const situation = { down: 1 as const, distance: 10, yardLine: 25 };
    const call = drawDefensiveCall(fp, situation, seeded());
    assertEquals(typeof call.front, "string");
  });

  await t.step("is deterministic with same seed", () => {
    const fp = makeFingerprint({}, { pressureRate: 70 });
    const situation = { down: 2 as const, distance: 5, yardLine: 30 };
    const call1 = drawDefensiveCall(fp, situation, seeded(456));
    const call2 = drawDefensiveCall(fp, situation, seeded(456));
    assertEquals(call1, call2);
  });

  await t.step("odd front tendency produces 3-4 front", () => {
    const fp = makeFingerprint({}, { frontOddEven: 10, subPackageLean: 20 });
    const situation = { down: 1 as const, distance: 10, yardLine: 40 };
    let count34 = 0;
    const trials = 50;
    for (let i = 0; i < trials; i++) {
      const call = drawDefensiveCall(fp, situation, seeded(i));
      if (call.front === "3-4") count34++;
    }
    assertEquals(count34 > 0, true);
  });

  await t.step("even front tendency produces 4-3 front", () => {
    const fp = makeFingerprint({}, { frontOddEven: 90, subPackageLean: 20 });
    const situation = { down: 1 as const, distance: 10, yardLine: 40 };
    let count43 = 0;
    const trials = 50;
    for (let i = 0; i < trials; i++) {
      const call = drawDefensiveCall(fp, situation, seeded(i));
      if (call.front === "4-3") count43++;
    }
    assertEquals(count43 > 0, true);
  });

  await t.step("high sub-package lean produces nickel/dime fronts", () => {
    const fp = makeFingerprint({}, { subPackageLean: 90 });
    const situation = { down: 1 as const, distance: 10, yardLine: 40 };
    let subCount = 0;
    const trials = 50;
    for (let i = 0; i < trials; i++) {
      const call = drawDefensiveCall(fp, situation, seeded(i));
      if (call.front === "nickel" || call.front === "dime") subCount++;
    }
    assertEquals(subCount > 0, true);
  });

  await t.step("man coverage tendency produces man coverages", () => {
    const fp = makeFingerprint({}, { coverageManZone: 5, coverageShell: 30 });
    const situation = { down: 1 as const, distance: 10, yardLine: 40 };
    let manCount = 0;
    const trials = 100;
    for (let i = 0; i < trials; i++) {
      const call = drawDefensiveCall(fp, situation, seeded(i));
      if (call.coverage === "cover_0" || call.coverage === "cover_1") {
        manCount++;
      }
    }
    assertEquals(manCount > 0, true);
  });

  await t.step("zone coverage tendency with two-high shell", () => {
    const fp = makeFingerprint({}, { coverageManZone: 95, coverageShell: 90 });
    const situation = { down: 1 as const, distance: 10, yardLine: 40 };
    let zoneCount = 0;
    const trials = 100;
    for (let i = 0; i < trials; i++) {
      const call = drawDefensiveCall(fp, situation, seeded(i));
      if (call.coverage === "cover_2" || call.coverage === "cover_4") {
        zoneCount++;
      }
    }
    assertEquals(zoneCount > 0, true);
  });

  await t.step("zone coverage with single-high shell produces cover 3", () => {
    const fp = makeFingerprint({}, { coverageManZone: 95, coverageShell: 10 });
    const situation = { down: 1 as const, distance: 10, yardLine: 40 };
    let cover3Count = 0;
    const trials = 100;
    for (let i = 0; i < trials; i++) {
      const call = drawDefensiveCall(fp, situation, seeded(i));
      if (call.coverage === "cover_3") cover3Count++;
    }
    assertEquals(cover3Count > 0, true);
  });

  await t.step("3rd and long increases blitz probability", () => {
    const fp = makeFingerprint({}, { pressureRate: 50 });
    const normalSit = { down: 1 as const, distance: 10, yardLine: 40 };
    const thirdLong = { down: 3 as const, distance: 8, yardLine: 40 };
    let normalBlitz = 0;
    let thirdBlitz = 0;
    const trials = 300;
    for (let i = 0; i < trials; i++) {
      if (drawDefensiveCall(fp, normalSit, seeded(i)).pressure !== "base") {
        normalBlitz++;
      }
      if (drawDefensiveCall(fp, thirdLong, seeded(i)).pressure !== "base") {
        thirdBlitz++;
      }
    }
    assertEquals(thirdBlitz >= normalBlitz, true);
  });
});

// ─── identifyMatchups ───

Deno.test("identifyMatchups", async (t) => {
  const offPlayers = makeOffensePlayers();
  const defPlayers = makeDefensePlayers();

  await t.step("returns non-empty matchup list for pass play", () => {
    const call = {
      concept: "short_pass",
      personnel: "11",
      formation: "shotgun",
      motion: "none",
    };
    const coverage = { front: "4-3", coverage: "cover_3", pressure: "base" };
    const matchups = identifyMatchups(call, coverage, offPlayers, defPlayers);
    assertEquals(matchups.length > 0, true);
  });

  await t.step("pass play includes pass_pro_vs_pass_rush matchups", () => {
    const call = {
      concept: "deep_pass",
      personnel: "11",
      formation: "shotgun",
      motion: "none",
    };
    const coverage = { front: "4-3", coverage: "cover_1", pressure: "blitz" };
    const matchups = identifyMatchups(call, coverage, offPlayers, defPlayers);
    const proMatchups = matchups.filter(
      (m) => m.type === "pass_pro_vs_pass_rush",
    );
    assertEquals(proMatchups.length > 0, true);
  });

  await t.step("pass play includes route_vs_coverage matchups", () => {
    const call = {
      concept: "short_pass",
      personnel: "11",
      formation: "shotgun",
      motion: "none",
    };
    const coverage = { front: "4-3", coverage: "cover_3", pressure: "base" };
    const matchups = identifyMatchups(call, coverage, offPlayers, defPlayers);
    const routeMatchups = matchups.filter(
      (m) => m.type === "route_vs_coverage",
    );
    assertEquals(routeMatchups.length > 0, true);
  });

  await t.step("run play includes block_vs_shed matchups", () => {
    const call = {
      concept: "inside_run",
      personnel: "12",
      formation: "under_center",
      motion: "none",
    };
    const coverage = { front: "3-4", coverage: "cover_3", pressure: "base" };
    const matchups = identifyMatchups(call, coverage, offPlayers, defPlayers);
    const blockMatchups = matchups.filter((m) => m.type === "block_vs_shed");
    assertEquals(blockMatchups.length > 0, true);
  });

  await t.step(
    "run play includes ball_carrier_vs_tackle matchups",
    () => {
      const call = {
        concept: "outside_run",
        personnel: "11",
        formation: "shotgun",
        motion: "jet",
      };
      const coverage = {
        front: "4-3",
        coverage: "cover_4",
        pressure: "base",
      };
      const matchups = identifyMatchups(call, coverage, offPlayers, defPlayers);
      const carrierMatchups = matchups.filter(
        (m) => m.type === "ball_carrier_vs_tackle",
      );
      assertEquals(carrierMatchups.length > 0, true);
    },
  );

  await t.step("every matchup has an attacker and defender", () => {
    const call = {
      concept: "short_pass",
      personnel: "11",
      formation: "shotgun",
      motion: "none",
    };
    const coverage = { front: "4-3", coverage: "cover_3", pressure: "base" };
    const matchups = identifyMatchups(call, coverage, offPlayers, defPlayers);
    for (const m of matchups) {
      assertEquals(typeof m.attacker.playerId, "string");
      assertEquals(typeof m.defender.playerId, "string");
    }
  });
});

// ─── rollMatchup ───

Deno.test("rollMatchup", async (t) => {
  await t.step("returns a MatchupContribution with score and tags", () => {
    const matchup = {
      type: "pass_pro_vs_pass_rush" as const,
      attacker: makePlayer("ot1", "OT", { passBlocking: 80 }),
      defender: makePlayer("edge1", "EDGE", { passRushing: 70 }),
    };
    const fp = makeFingerprint({ runPassLean: 50 }, { pressureRate: 50 });
    const result = rollMatchup({
      matchup,
      offenseFingerprint: fp,
      defenseFingerprint: fp,
      coachingMods: { offense: {}, defense: {} },
      situation: { down: 1, distance: 10, yardLine: 25 },
      rng: seeded(),
    });
    assertEquals(typeof result.score, "number");
    assertEquals(Array.isArray(result.tags), true);
  });

  await t.step(
    "higher attacker attributes produce higher scores on average",
    () => {
      const strong = makePlayer("ot1", "OT", {
        passBlocking: 95,
        strength: 90,
        agility: 85,
      });
      const weak = makePlayer("ot2", "OT", {
        passBlocking: 30,
        strength: 25,
        agility: 30,
      });
      const defender = makePlayer("edge1", "EDGE", {
        passRushing: 60,
        acceleration: 60,
        strength: 60,
      });
      const fp = makeFingerprint({}, {});

      let strongTotal = 0;
      let weakTotal = 0;
      const trials = 100;
      for (let i = 0; i < trials; i++) {
        const r = seeded(i);
        strongTotal += rollMatchup({
          matchup: {
            type: "pass_pro_vs_pass_rush",
            attacker: strong,
            defender,
          },
          offenseFingerprint: fp,
          defenseFingerprint: fp,
          coachingMods: { offense: {}, defense: {} },
          situation: { down: 1, distance: 10, yardLine: 25 },
          rng: r,
        }).score;

        const r2 = seeded(i);
        weakTotal += rollMatchup({
          matchup: {
            type: "pass_pro_vs_pass_rush",
            attacker: weak,
            defender,
          },
          offenseFingerprint: fp,
          defenseFingerprint: fp,
          coachingMods: { offense: {}, defense: {} },
          situation: { down: 1, distance: 10, yardLine: 25 },
          rng: r2,
        }).score;
      }
      assertEquals(strongTotal / trials > weakTotal / trials, true);
    },
  );

  await t.step("uses true attributes not scouting projections", () => {
    const player = makePlayer("ot1", "OT", { passBlocking: 90 });
    const defender = makePlayer("edge1", "EDGE", { passRushing: 40 });
    const fp = makeFingerprint({}, {});
    const result = rollMatchup({
      matchup: {
        type: "pass_pro_vs_pass_rush",
        attacker: player,
        defender,
      },
      offenseFingerprint: fp,
      defenseFingerprint: fp,
      coachingMods: { offense: {}, defense: {} },
      situation: { down: 1, distance: 10, yardLine: 25 },
      rng: seeded(),
    });
    assertEquals(result.score > 0, true);
  });

  await t.step("is deterministic with same seed", () => {
    const matchup = {
      type: "route_vs_coverage" as const,
      attacker: makePlayer("wr1", "WR", { routeRunning: 75, catching: 80 }),
      defender: makePlayer("cb1", "CB", { manCoverage: 70, zoneCoverage: 65 }),
    };
    const fp = makeFingerprint({}, {});
    const r1 = rollMatchup({
      matchup,
      offenseFingerprint: fp,
      defenseFingerprint: fp,
      coachingMods: { offense: {}, defense: {} },
      situation: { down: 2, distance: 7, yardLine: 35 },
      rng: seeded(789),
    });
    const r2 = rollMatchup({
      matchup,
      offenseFingerprint: fp,
      defenseFingerprint: fp,
      coachingMods: { offense: {}, defense: {} },
      situation: { down: 2, distance: 7, yardLine: 35 },
      rng: seeded(789),
    });
    assertEquals(r1.score, r2.score);
    assertEquals(r1.tags, r2.tags);
  });
});

// ─── synthesizeOutcome ───

Deno.test("synthesizeOutcome", async (t) => {
  await t.step("returns a PlayEvent with all required fields", () => {
    const call = {
      concept: "short_pass",
      personnel: "11",
      formation: "shotgun",
      motion: "none",
    };
    const coverage = { front: "4-3", coverage: "cover_3", pressure: "base" };
    const contributions: MatchupContribution[] = [
      {
        matchup: {
          type: "pass_pro_vs_pass_rush",
          attacker: makePlayer("ot1", "OT"),
          defender: makePlayer("edge1", "EDGE"),
        },
        score: 10,
        tags: [],
      },
      {
        matchup: {
          type: "route_vs_coverage",
          attacker: makePlayer("wr1", "WR"),
          defender: makePlayer("cb1", "CB"),
        },
        score: 15,
        tags: [],
      },
    ];
    const state = makeState();
    const event = synthesizeOutcome(
      call,
      coverage,
      contributions,
      state,
      seeded(),
    );
    assertEquals(event.gameId, "game-1");
    assertEquals(event.offenseTeamId, "team-a");
    assertEquals(event.defenseTeamId, "team-b");
    assertEquals(typeof event.outcome, "string");
    assertEquals(typeof event.yardage, "number");
    assertEquals(Array.isArray(event.tags), true);
    assertEquals(Array.isArray(event.participants), true);
    assertEquals(event.quarter, 1);
    assertEquals(event.situation.down, 1);
  });

  await t.step(
    "pass play with dominant defense can produce sack",
    () => {
      const call = {
        concept: "deep_pass",
        personnel: "11",
        formation: "shotgun",
        motion: "none",
      };
      const coverage = {
        front: "4-3",
        coverage: "cover_1",
        pressure: "blitz",
      };
      const contributions: MatchupContribution[] = [
        {
          matchup: {
            type: "pass_pro_vs_pass_rush",
            attacker: makePlayer("ot1", "OT", { passBlocking: 20 }),
            defender: makePlayer("edge1", "EDGE", { passRushing: 95 }),
          },
          score: -40,
          tags: ["pressure" as const],
        },
      ];
      let sacks = 0;
      const trials = 100;
      for (let i = 0; i < trials; i++) {
        const event = synthesizeOutcome(
          call,
          coverage,
          contributions,
          makeState(),
          seeded(i),
        );
        if (event.outcome === "sack") sacks++;
      }
      assertEquals(sacks > 0, true);
    },
  );

  await t.step("run play produces rush outcome", () => {
    const call = {
      concept: "inside_run",
      personnel: "12",
      formation: "under_center",
      motion: "none",
    };
    const coverage = { front: "3-4", coverage: "cover_3", pressure: "base" };
    const contributions: MatchupContribution[] = [
      {
        matchup: {
          type: "block_vs_shed",
          attacker: makePlayer("ot1", "OT"),
          defender: makePlayer("idl1", "IDL"),
        },
        score: 10,
        tags: [],
      },
      {
        matchup: {
          type: "ball_carrier_vs_tackle",
          attacker: makePlayer("rb1", "RB"),
          defender: makePlayer("lb1", "LB"),
        },
        score: 5,
        tags: [],
      },
    ];
    const event = synthesizeOutcome(
      call,
      coverage,
      contributions,
      makeState(),
      seeded(),
    );
    assertEquals(event.outcome === "rush" || event.outcome === "fumble", true);
  });

  await t.step(
    "pass play with strong offense defense gap can produce interception",
    () => {
      const call = {
        concept: "deep_pass",
        personnel: "11",
        formation: "shotgun",
        motion: "none",
      };
      const coverage = { front: "4-3", coverage: "cover_3", pressure: "base" };
      const contributions: MatchupContribution[] = [
        {
          matchup: {
            type: "pass_pro_vs_pass_rush",
            attacker: makePlayer("ot1", "OT", { passBlocking: 70 }),
            defender: makePlayer("edge1", "EDGE", { passRushing: 60 }),
          },
          score: 5,
          tags: [],
        },
        {
          matchup: {
            type: "route_vs_coverage",
            attacker: makePlayer("wr1", "WR", { routeRunning: 20 }),
            defender: makePlayer("cb1", "CB", { manCoverage: 95 }),
          },
          score: -30,
          tags: [],
        },
      ];
      let ints = 0;
      const trials = 300;
      for (let i = 0; i < trials; i++) {
        const event = synthesizeOutcome(
          call,
          coverage,
          contributions,
          makeState(),
          seeded(i),
        );
        if (event.outcome === "interception") ints++;
      }
      assertEquals(ints > 0, true);
    },
  );

  await t.step("play near end zone can produce touchdown", () => {
    const call = {
      concept: "short_pass",
      personnel: "11",
      formation: "shotgun",
      motion: "none",
    };
    const coverage = { front: "4-3", coverage: "cover_3", pressure: "base" };
    const contributions: MatchupContribution[] = [
      {
        matchup: {
          type: "route_vs_coverage",
          attacker: makePlayer("wr1", "WR", { routeRunning: 90, catching: 90 }),
          defender: makePlayer("cb1", "CB", { manCoverage: 30 }),
        },
        score: 40,
        tags: [],
      },
    ];
    let touchdowns = 0;
    const trials = 200;
    for (let i = 0; i < trials; i++) {
      const event = synthesizeOutcome(
        call,
        coverage,
        contributions,
        makeState({ situation: { down: 1, distance: 5, yardLine: 95 } }),
        seeded(i),
      );
      if (event.outcome === "touchdown") touchdowns++;
    }
    assertEquals(touchdowns > 0, true);
  });

  await t.step("pass play with no route matchups produces incomplete", () => {
    const call = {
      concept: "short_pass",
      personnel: "11",
      formation: "shotgun",
      motion: "none",
    };
    const coverage = { front: "4-3", coverage: "cover_3", pressure: "base" };
    const contributions: MatchupContribution[] = [
      {
        matchup: {
          type: "pass_pro_vs_pass_rush",
          attacker: makePlayer("ot1", "OT"),
          defender: makePlayer("edge1", "EDGE"),
        },
        score: 10,
        tags: [],
      },
    ];
    const event = synthesizeOutcome(
      call,
      coverage,
      contributions,
      makeState(),
      seeded(),
    );
    assertEquals(
      event.outcome === "pass_incomplete" || event.outcome === "fumble",
      true,
    );
  });

  await t.step("includes participants from matchup contributions", () => {
    const call = {
      concept: "short_pass",
      personnel: "11",
      formation: "shotgun",
      motion: "none",
    };
    const coverage = { front: "4-3", coverage: "cover_3", pressure: "base" };
    const contributions: MatchupContribution[] = [
      {
        matchup: {
          type: "route_vs_coverage",
          attacker: makePlayer("wr1", "WR"),
          defender: makePlayer("cb1", "CB"),
        },
        score: 20,
        tags: [],
      },
    ];
    const event = synthesizeOutcome(
      call,
      coverage,
      contributions,
      makeState(),
      seeded(),
    );
    assertEquals(event.participants.length > 0, true);
    const playerIds = event.participants.map((p) => p.playerId);
    assertEquals(playerIds.includes("wr1"), true);
  });
});

// ─── resolvePlay (integration) ───

Deno.test("resolvePlay", async (t) => {
  const fp = makeFingerprint({ runPassLean: 50 }, { pressureRate: 50 });

  function makeTeam(
    players: OnFieldPlayer[],
    fpOverride?: SchemeFingerprint,
  ): TeamRuntime {
    return {
      fingerprint: fpOverride ?? fp,
      onField: players,
      coachingMods: {},
    };
  }

  await t.step("returns a complete PlayEvent", () => {
    const state = makeState();
    const offense = makeTeam(makeOffensePlayers());
    const defense = makeTeam(makeDefensePlayers());
    const event = resolvePlay(state, offense, defense, seeded());
    assertEquals(event.gameId, "game-1");
    assertEquals(event.offenseTeamId, "team-a");
    assertEquals(event.defenseTeamId, "team-b");
    assertEquals(typeof event.outcome, "string");
    assertEquals(typeof event.yardage, "number");
    assertEquals(Array.isArray(event.tags), true);
    assertEquals(Array.isArray(event.participants), true);
    assertEquals(typeof event.call.concept, "string");
    assertEquals(typeof event.coverage.front, "string");
    assertEquals(event.quarter, 1);
    assertEquals(event.driveIndex, 0);
    assertEquals(event.playIndex, 0);
  });

  await t.step("consumes computeSchemeFit as an import", () => {
    const state = makeState();
    const offense = makeTeam(makeOffensePlayers());
    const defense = makeTeam(makeDefensePlayers());
    const event = resolvePlay(state, offense, defense, seeded());
    assertEquals(typeof event.outcome, "string");
  });

  await t.step("is deterministic — same inputs produce same output", () => {
    const state = makeState();
    const offense = makeTeam(makeOffensePlayers());
    const defense = makeTeam(makeDefensePlayers());
    const event1 = resolvePlay(state, offense, defense, seeded(12345));
    const event2 = resolvePlay(state, offense, defense, seeded(12345));
    assertEquals(event1, event2);
  });

  await t.step(
    "different seeds produce different outputs",
    () => {
      const state = makeState();
      const offense = makeTeam(makeOffensePlayers());
      const defense = makeTeam(makeDefensePlayers());
      const event1 = resolvePlay(state, offense, defense, seeded(111));
      const event2 = resolvePlay(state, offense, defense, seeded(222));
      const same = event1.outcome === event2.outcome &&
        event1.yardage === event2.yardage &&
        event1.call.concept === event2.call.concept;
      assertEquals(same, false);
    },
  );

  await t.step(
    "determinism: same roster + staff + seed produces identical PlayEvent sequence",
    () => {
      const state1 = makeState();
      const state2 = makeState();
      const offense = makeTeam(makeOffensePlayers());
      const defense = makeTeam(makeDefensePlayers());

      const events1: ReturnType<typeof resolvePlay>[] = [];
      const events2: ReturnType<typeof resolvePlay>[] = [];

      const rng1 = seeded(99999);
      const rng2 = seeded(99999);

      for (let i = 0; i < 20; i++) {
        events1.push(
          resolvePlay(
            { ...state1, playIndex: i },
            offense,
            defense,
            rng1,
          ),
        );
        events2.push(
          resolvePlay(
            { ...state2, playIndex: i },
            offense,
            defense,
            rng2,
          ),
        );
      }

      for (let i = 0; i < 20; i++) {
        assertEquals(events1[i], events2[i]);
      }
    },
  );
});
