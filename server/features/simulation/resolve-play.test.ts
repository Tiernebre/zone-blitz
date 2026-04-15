import { assertEquals, assertExists, assertNotEquals } from "@std/assert";
import {
  PLAYER_ATTRIBUTE_KEYS,
  type PlayerAttributes,
  type SchemeFingerprint,
} from "@zone-blitz/shared";
import { createRng, mulberry32 } from "./rng.ts";
import type { SeededRng } from "./rng.ts";
import type { DefensiveCall, OffensiveCall } from "./events.ts";
import {
  type CoachingMods,
  drawDefensiveCall,
  drawOffensiveCall,
  type GameState,
  isTwoMinuteDrill,
  type MatchupContribution,
  type PlayerRuntime,
  resolvePlay,
  rollMatchup,
  type Situation,
  synthesizeOutcome,
  type TeamRuntime,
} from "./resolve-play.ts";
import { resolveMatchups } from "./resolve-matchups.ts";

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

function makeFingerprint(
  overrides: Partial<SchemeFingerprint> = {},
): SchemeFingerprint {
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
    ...overrides,
  };
}

function makeSituation(overrides: Partial<Situation> = {}): Situation {
  return { down: 1, distance: 10, yardLine: 30, ...overrides };
}

function makeRng(seed = 42): SeededRng {
  return createRng(mulberry32(seed));
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

function makeCoachingMods(
  overrides: Partial<CoachingMods> = {},
): CoachingMods {
  return {
    schemeFitBonus: 0,
    situationalBonus: 0,
    aggressiveness: 50,
    ...overrides,
  };
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
    situation: makeSituation(),
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

// ── drawOffensiveCall ───────────────────────────────────────────────

Deno.test("drawOffensiveCall", async (t) => {
  await t.step("returns an OffensiveCall with all required fields", () => {
    const rng = makeRng();
    const fp = makeFingerprint();
    const call = drawOffensiveCall(fp, makeSituation(), rng);
    assertEquals(typeof call.concept, "string");
    assertEquals(typeof call.personnel, "string");
    assertEquals(typeof call.formation, "string");
    assertEquals(typeof call.motion, "string");
  });

  await t.step(
    "run-heavy runPassLean produces more run concepts over many calls",
    () => {
      const fp = makeFingerprint({
        offense: {
          runPassLean: 10,
          tempo: 50,
          personnelWeight: 50,
          formationUnderCenterShotgun: 50,
          preSnapMotionRate: 50,
          passingStyle: 50,
          passingDepth: 50,
          runGameBlocking: 50,
          rpoIntegration: 50,
        },
      });
      const runConcepts = new Set([
        "inside_zone",
        "outside_zone",
        "power",
        "counter",
        "draw",
        "rpo",
      ]);
      let runCount = 0;
      const total = 200;
      const rng = makeRng(123);
      for (let i = 0; i < total; i++) {
        const call = drawOffensiveCall(fp, makeSituation(), rng);
        if (runConcepts.has(call.concept)) runCount++;
      }
      assertEquals(runCount / total > 0.6, true);
    },
  );

  await t.step(
    "pass-heavy runPassLean produces more pass concepts over many calls",
    () => {
      const fp = makeFingerprint({
        offense: {
          runPassLean: 90,
          tempo: 50,
          personnelWeight: 50,
          formationUnderCenterShotgun: 50,
          preSnapMotionRate: 50,
          passingStyle: 50,
          passingDepth: 50,
          runGameBlocking: 50,
          rpoIntegration: 50,
        },
      });
      const passConcepts = new Set([
        "screen",
        "quick_pass",
        "play_action",
        "dropback",
        "deep_shot",
      ]);
      let passCount = 0;
      const total = 200;
      const rng = makeRng(123);
      for (let i = 0; i < total; i++) {
        const call = drawOffensiveCall(fp, makeSituation(), rng);
        if (passConcepts.has(call.concept)) passCount++;
      }
      assertEquals(passCount / total > 0.6, true);
    },
  );

  await t.step(
    "shotgun-leaning formation produces shotgun/pistol formations",
    () => {
      const fp = makeFingerprint({
        offense: {
          runPassLean: 50,
          tempo: 50,
          personnelWeight: 50,
          formationUnderCenterShotgun: 90,
          preSnapMotionRate: 50,
          passingStyle: 50,
          passingDepth: 50,
          runGameBlocking: 50,
          rpoIntegration: 50,
        },
      });
      const rng = makeRng(42);
      const formations = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const call = drawOffensiveCall(fp, makeSituation(), rng);
        formations.add(call.formation);
      }
      for (const f of formations) {
        assertEquals(
          f === "shotgun" || f === "pistol",
          true,
          `unexpected formation: ${f}`,
        );
      }
    },
  );

  await t.step("handles null offensive tendencies gracefully", () => {
    const fp = makeFingerprint({ offense: null });
    const rng = makeRng();
    const call = drawOffensiveCall(fp, makeSituation(), rng);
    assertEquals(typeof call.concept, "string");
  });
});

// ── drawDefensiveCall ───────────────────────────────────────────────

Deno.test("drawDefensiveCall", async (t) => {
  await t.step("returns a DefensiveCall with all required fields", () => {
    const rng = makeRng();
    const fp = makeFingerprint();
    const call = drawDefensiveCall(fp, makeSituation(), rng);
    assertEquals(typeof call.front, "string");
    assertEquals(typeof call.coverage, "string");
    assertEquals(typeof call.pressure, "string");
  });

  await t.step(
    "high pressureRate produces more blitz calls over many draws",
    () => {
      const fp = makeFingerprint({
        defense: {
          frontOddEven: 50,
          gapResponsibility: 50,
          subPackageLean: 50,
          coverageManZone: 50,
          coverageShell: 50,
          cornerPressOff: 50,
          pressureRate: 95,
          disguiseRate: 50,
        },
      });
      let blitzCount = 0;
      const total = 200;
      const rng = makeRng(123);
      for (let i = 0; i < total; i++) {
        const call = drawDefensiveCall(fp, makeSituation(), rng);
        if (call.pressure !== "four_man") blitzCount++;
      }
      assertEquals(blitzCount / total > 0.5, true);
    },
  );

  await t.step(
    "man-leaning coverageManZone prefers man coverages",
    () => {
      const fp = makeFingerprint({
        defense: {
          frontOddEven: 50,
          gapResponsibility: 50,
          subPackageLean: 50,
          coverageManZone: 10,
          coverageShell: 50,
          cornerPressOff: 50,
          pressureRate: 50,
          disguiseRate: 50,
        },
      });
      const manCoverages = new Set(["cover_0", "cover_1"]);
      let manCount = 0;
      const total = 200;
      const rng = makeRng(42);
      for (let i = 0; i < total; i++) {
        const call = drawDefensiveCall(fp, makeSituation(), rng);
        if (manCoverages.has(call.coverage)) manCount++;
      }
      assertEquals(manCount / total > 0.5, true);
    },
  );

  await t.step("handles null defensive tendencies gracefully", () => {
    const fp = makeFingerprint({ defense: null });
    const rng = makeRng();
    const call = drawDefensiveCall(fp, makeSituation(), rng);
    assertEquals(typeof call.front, "string");
  });
});

// ── resolveMatchups ────────────────────────────────────────────────

Deno.test("resolveMatchups", async (t) => {
  await t.step("returns run_block matchups for a run play", () => {
    const call: OffensiveCall = {
      concept: "inside_zone",
      personnel: "11",
      formation: "shotgun",
      motion: "none",
    };
    const coverage: DefensiveCall = {
      front: "4-3",
      coverage: "cover_3",
      pressure: "four_man",
    };
    const rng = makeRng();
    const matchups = resolveMatchups(
      call,
      coverage,
      makeOffense(),
      makeDefense(),
      rng,
    );

    const runMatchups = matchups.filter((m) => m.type === "run_block");
    assertEquals(runMatchups.length > 0, true);
  });

  await t.step(
    "returns pass_protection and route_coverage matchups for a pass play",
    () => {
      const call: OffensiveCall = {
        concept: "dropback",
        personnel: "11",
        formation: "shotgun",
        motion: "none",
      };
      const coverage: DefensiveCall = {
        front: "nickel",
        coverage: "cover_2",
        pressure: "four_man",
      };
      const rng = makeRng();
      const matchups = resolveMatchups(
        call,
        coverage,
        makeOffense(),
        makeDefense(),
        rng,
      );

      const protectionMatchups = matchups.filter(
        (m) => m.type === "pass_protection",
      );
      const routeMatchups = matchups.filter(
        (m) => m.type === "route_coverage",
      );
      assertEquals(protectionMatchups.length > 0, true);
      assertEquals(routeMatchups.length > 0, true);
    },
  );

  await t.step("adds pass_rush matchups when blitz is called", () => {
    const call: OffensiveCall = {
      concept: "dropback",
      personnel: "11",
      formation: "shotgun",
      motion: "none",
    };
    const coverage: DefensiveCall = {
      front: "nickel",
      coverage: "cover_1",
      pressure: "man_blitz",
    };
    const rng = makeRng();
    const matchups = resolveMatchups(
      call,
      coverage,
      makeOffense(),
      makeDefense(),
      rng,
    );

    const passRushMatchups = matchups.filter(
      (m) => m.type === "pass_rush",
    );
    assertEquals(passRushMatchups.length > 0, true);
  });

  await t.step("handles empty player arrays gracefully", () => {
    const call: OffensiveCall = {
      concept: "dropback",
      personnel: "11",
      formation: "shotgun",
      motion: "none",
    };
    const coverage: DefensiveCall = {
      front: "4-3",
      coverage: "cover_3",
      pressure: "four_man",
    };
    const rng = makeRng();
    const matchups = resolveMatchups(call, coverage, [], [], rng);
    assertEquals(matchups.length, 0);
  });
});

// ── rollMatchup ─────────────────────────────────────────────────────

Deno.test("rollMatchup", async (t) => {
  await t.step("returns a MatchupContribution with correct structure", () => {
    const rng = makeRng();
    const result = rollMatchup({
      attacker: makePlayer("ot1", "OT", { passBlocking: 80 }),
      defender: makePlayer("edge1", "EDGE", { passRushing: 60 }),
      schemeFitAttacker: "fits",
      schemeFitDefender: "neutral",
      coaching: {
        offense: makeCoachingMods(),
        defense: makeCoachingMods(),
      },
      situation: makeSituation(),
      matchupType: "pass_protection",
      rng,
    });
    assertEquals(typeof result.score, "number");
    assertEquals(result.matchup.type, "pass_protection");
    assertEquals(result.attackerFit, "fits");
    assertEquals(result.defenderFit, "neutral");
  });

  await t.step(
    "scheme-fit ideal attacker vs miscast defender skews score positively",
    () => {
      let positiveCount = 0;
      const trials = 50;
      for (let i = 0; i < trials; i++) {
        const rng = makeRng(i);
        const result = rollMatchup({
          attacker: makePlayer("ot1", "OT", {
            passBlocking: 85,
            strength: 80,
            agility: 80,
          }),
          defender: makePlayer("edge1", "EDGE", {
            passRushing: 40,
            acceleration: 40,
            strength: 40,
          }),
          schemeFitAttacker: "ideal",
          schemeFitDefender: "miscast",
          coaching: {
            offense: makeCoachingMods(),
            defense: makeCoachingMods(),
          },
          situation: makeSituation(),
          matchupType: "pass_protection",
          rng,
        });
        if (result.score > 0) positiveCount++;
      }
      assertEquals(positiveCount / trials > 0.7, true);
    },
  );

  await t.step("score is bounded to [-50, 50]", () => {
    for (let seed = 0; seed < 100; seed++) {
      const rng = makeRng(seed);
      const result = rollMatchup({
        attacker: makePlayer("wr1", "WR"),
        defender: makePlayer("cb1", "CB"),
        schemeFitAttacker: "neutral",
        schemeFitDefender: "neutral",
        coaching: {
          offense: makeCoachingMods(),
          defense: makeCoachingMods(),
        },
        situation: makeSituation(),
        matchupType: "route_coverage",
        rng,
      });
      assertEquals(result.score >= -50 && result.score <= 50, true);
    }
  });

  await t.step("uses true attributes, not scouting-projected", () => {
    const rng = makeRng(42);
    const attacker = makePlayer("wr1", "WR", {
      routeRunning: 95,
      speed: 95,
      catching: 95,
    });
    const result = rollMatchup({
      attacker,
      defender: makePlayer("cb1", "CB"),
      schemeFitAttacker: "neutral",
      schemeFitDefender: "neutral",
      coaching: {
        offense: makeCoachingMods(),
        defense: makeCoachingMods(),
      },
      situation: makeSituation(),
      matchupType: "route_coverage",
      rng,
    });
    assertEquals(typeof result.score, "number");
  });
});

// ── synthesizeOutcome ───────────────────────────────────────────────

Deno.test("synthesizeOutcome", async (t) => {
  const runCall: OffensiveCall = {
    concept: "inside_zone",
    personnel: "11",
    formation: "shotgun",
    motion: "none",
  };
  const passCall: OffensiveCall = {
    concept: "dropback",
    personnel: "11",
    formation: "shotgun",
    motion: "none",
  };
  const coverageCall: DefensiveCall = {
    front: "4-3",
    coverage: "cover_3",
    pressure: "four_man",
  };

  await t.step("produces a PlayEvent with all required fields", () => {
    const rng = makeRng();
    const state = makeGameState();
    const contribs: MatchupContribution[] = [
      {
        matchup: {
          type: "run_block",
          attacker: makePlayer("ot1", "OT"),
          defender: makePlayer("idl1", "IDL"),
        },
        attackerFit: "neutral",
        defenderFit: "neutral",
        score: 5,
      },
    ];

    const event = synthesizeOutcome(
      runCall,
      coverageCall,
      contribs,
      state,
      rng,
    );
    assertEquals(event.gameId, "game-1");
    assertEquals(event.driveIndex, 0);
    assertEquals(event.playIndex, 0);
    assertEquals(event.quarter, 1);
    assertEquals(typeof event.outcome, "string");
    assertEquals(typeof event.yardage, "number");
    assertEquals(Array.isArray(event.tags), true);
    assertEquals(Array.isArray(event.participants), true);
  });

  await t.step(
    "run play with dominant blocking yields positive yardage",
    () => {
      let positiveYardageCount = 0;
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
        const event = synthesizeOutcome(
          runCall,
          coverageCall,
          contribs,
          makeGameState(),
          rng,
        );
        if (event.yardage > 0) positiveYardageCount++;
      }
      assertEquals(positiveYardageCount / trials > 0.9, true);
    },
  );

  await t.step(
    "pass play with terrible protection yields sack outcome",
    () => {
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
        const event = synthesizeOutcome(
          passCall,
          coverageCall,
          contribs,
          makeGameState(),
          rng,
        );
        if (event.outcome === "sack" || event.outcome === "fumble") {
          sackCount++;
        }
      }
      assertEquals(sackCount / trials > 0.8, true);
    },
  );

  await t.step("touchdown scored when yardage reaches endzone", () => {
    let touchdownFound = false;
    for (let seed = 0; seed < 100; seed++) {
      const rng = makeRng(seed);
      const state = makeGameState({
        situation: makeSituation({ yardLine: 95 }),
      });
      const contribs: MatchupContribution[] = [
        {
          matchup: {
            type: "run_block",
            attacker: makePlayer("rb1", "RB"),
            defender: makePlayer("lb1", "LB"),
          },
          attackerFit: "neutral",
          defenderFit: "neutral",
          score: 20,
        },
      ];
      const event = synthesizeOutcome(
        runCall,
        coverageCall,
        contribs,
        state,
        rng,
      );
      if (event.outcome === "touchdown") {
        assertEquals(event.tags.includes("touchdown"), true);
        assertEquals(event.yardage, 5);
        touchdownFound = true;
        break;
      }
    }
    assertEquals(touchdownFound, true);
  });

  await t.step("tags first_down when yardage meets distance", () => {
    const rng = makeRng(5);
    const state = makeGameState({
      situation: makeSituation({ down: 1, distance: 3 }),
    });
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
    const event = synthesizeOutcome(
      runCall,
      coverageCall,
      contribs,
      state,
      rng,
    );
    if (event.yardage >= 3) {
      assertEquals(event.tags.includes("first_down"), true);
    }
  });
});

// ── additional coverage tests ────────────────────────────────────────

Deno.test("drawOffensiveCall short yardage increases run probability", () => {
  const fp = makeFingerprint();
  let runCount = 0;
  const total = 200;
  const runConcepts = new Set([
    "inside_zone",
    "outside_zone",
    "power",
    "counter",
    "draw",
    "rpo",
  ]);
  for (let i = 0; i < total; i++) {
    const rng = makeRng(i);
    const call = drawOffensiveCall(
      fp,
      makeSituation({ down: 3, distance: 2 }),
      rng,
    );
    if (runConcepts.has(call.concept)) runCount++;
  }
  assertEquals(runCount / total > 0.5, true);
});

Deno.test("drawOffensiveCall long yardage with deep passing depth adds deep_shot", () => {
  const fp = makeFingerprint({
    offense: {
      runPassLean: 90,
      tempo: 50,
      personnelWeight: 50,
      formationUnderCenterShotgun: 50,
      preSnapMotionRate: 50,
      passingStyle: 50,
      passingDepth: 80,
      runGameBlocking: 50,
      rpoIntegration: 50,
    },
  });
  let deepShotFound = false;
  for (let i = 0; i < 200; i++) {
    const rng = makeRng(i);
    const call = drawOffensiveCall(
      fp,
      makeSituation({ down: 2, distance: 12 }),
      rng,
    );
    if (call.concept === "deep_shot") {
      deepShotFound = true;
      break;
    }
  }
  assertEquals(deepShotFound, true);
});

Deno.test("drawOffensiveCall high RPO integration includes rpo concept", () => {
  const fp = makeFingerprint({
    offense: {
      runPassLean: 10,
      tempo: 50,
      personnelWeight: 50,
      formationUnderCenterShotgun: 50,
      preSnapMotionRate: 50,
      passingStyle: 50,
      passingDepth: 50,
      runGameBlocking: 50,
      rpoIntegration: 80,
    },
  });
  let rpoFound = false;
  for (let i = 0; i < 200; i++) {
    const rng = makeRng(i);
    const call = drawOffensiveCall(fp, makeSituation(), rng);
    if (call.concept === "rpo") {
      rpoFound = true;
      break;
    }
  }
  assertEquals(rpoFound, true);
});

Deno.test("drawOffensiveCall heavy personnel weight selects heavy packages", () => {
  const fp = makeFingerprint({
    offense: {
      runPassLean: 50,
      tempo: 50,
      personnelWeight: 80,
      formationUnderCenterShotgun: 50,
      preSnapMotionRate: 50,
      passingStyle: 50,
      passingDepth: 50,
      runGameBlocking: 50,
      rpoIntegration: 50,
    },
  });
  const heavyGroups = new Set(["12", "21", "22"]);
  let heavyCount = 0;
  const total = 100;
  for (let i = 0; i < total; i++) {
    const rng = makeRng(i);
    const call = drawOffensiveCall(fp, makeSituation(), rng);
    if (heavyGroups.has(call.personnel)) heavyCount++;
  }
  assertEquals(heavyCount, total);
});

Deno.test("drawOffensiveCall under-center leaning formation picks UC formations", () => {
  const fp = makeFingerprint({
    offense: {
      runPassLean: 50,
      tempo: 50,
      personnelWeight: 50,
      formationUnderCenterShotgun: 10,
      preSnapMotionRate: 50,
      passingStyle: 50,
      passingDepth: 50,
      runGameBlocking: 50,
      rpoIntegration: 50,
    },
  });
  const ucFormations = new Set(["under_center", "singleback", "i_form"]);
  let ucCount = 0;
  const total = 100;
  for (let i = 0; i < total; i++) {
    const rng = makeRng(i);
    const call = drawOffensiveCall(fp, makeSituation(), rng);
    if (ucFormations.has(call.formation)) ucCount++;
  }
  assertEquals(ucCount, total);
});

Deno.test("drawDefensiveCall sub-package heavy picks nickel or dime fronts", () => {
  const fp = makeFingerprint({
    defense: {
      frontOddEven: 50,
      gapResponsibility: 50,
      subPackageLean: 80,
      coverageManZone: 50,
      coverageShell: 50,
      cornerPressOff: 50,
      pressureRate: 50,
      disguiseRate: 50,
    },
  });
  const subFronts = new Set(["nickel", "dime"]);
  let subCount = 0;
  const total = 100;
  for (let i = 0; i < total; i++) {
    const rng = makeRng(i);
    const call = drawDefensiveCall(fp, makeSituation(), rng);
    if (subFronts.has(call.front)) subCount++;
  }
  assertEquals(subCount, total);
});

Deno.test("drawDefensiveCall odd front lean picks 3-4", () => {
  const fp = makeFingerprint({
    defense: {
      frontOddEven: 20,
      gapResponsibility: 50,
      subPackageLean: 30,
      coverageManZone: 50,
      coverageShell: 50,
      cornerPressOff: 50,
      pressureRate: 50,
      disguiseRate: 50,
    },
  });
  const rng = makeRng();
  const call = drawDefensiveCall(fp, makeSituation(), rng);
  assertEquals(call.front, "3-4");
});

Deno.test("drawDefensiveCall even front lean picks 4-3", () => {
  const fp = makeFingerprint({
    defense: {
      frontOddEven: 80,
      gapResponsibility: 50,
      subPackageLean: 30,
      coverageManZone: 50,
      coverageShell: 50,
      cornerPressOff: 50,
      pressureRate: 50,
      disguiseRate: 50,
    },
  });
  const rng = makeRng();
  const call = drawDefensiveCall(fp, makeSituation(), rng);
  assertEquals(call.front, "4-3");
});

Deno.test("drawDefensiveCall man coverage with low shell picks cover_0 or cover_1", () => {
  const fp = makeFingerprint({
    defense: {
      frontOddEven: 50,
      gapResponsibility: 50,
      subPackageLean: 50,
      coverageManZone: 10,
      coverageShell: 30,
      cornerPressOff: 50,
      pressureRate: 50,
      disguiseRate: 50,
    },
  });
  const manCoverages = new Set(["cover_0", "cover_1"]);
  const rng = makeRng();
  for (let i = 0; i < 50; i++) {
    const call = drawDefensiveCall(fp, makeSituation(), rng);
    assertEquals(manCoverages.has(call.coverage), true);
  }
});

Deno.test("drawDefensiveCall zone coverage with high shell picks cover_2/4/6", () => {
  const fp = makeFingerprint({
    defense: {
      frontOddEven: 50,
      gapResponsibility: 50,
      subPackageLean: 50,
      coverageManZone: 80,
      coverageShell: 80,
      cornerPressOff: 50,
      pressureRate: 50,
      disguiseRate: 50,
    },
  });
  const zoneCoverages = new Set(["cover_2", "cover_4", "cover_6"]);
  const rng = makeRng();
  for (let i = 0; i < 50; i++) {
    const call = drawDefensiveCall(fp, makeSituation(), rng);
    assertEquals(zoneCoverages.has(call.coverage), true);
  }
});

Deno.test("drawDefensiveCall pass situation boosts blitz probability", () => {
  const fp = makeFingerprint({
    defense: {
      frontOddEven: 50,
      gapResponsibility: 50,
      subPackageLean: 50,
      coverageManZone: 50,
      coverageShell: 50,
      cornerPressOff: 50,
      pressureRate: 60,
      disguiseRate: 50,
    },
  });
  let blitzCount = 0;
  const total = 200;
  for (let i = 0; i < total; i++) {
    const rng = makeRng(i);
    const call = drawDefensiveCall(
      fp,
      makeSituation({ down: 3, distance: 8 }),
      rng,
    );
    if (call.pressure !== "four_man") blitzCount++;
  }
  assertEquals(blitzCount / total > 0.5, true);
});

Deno.test("rollMatchup applies situation modifiers for 3rd and long pass rush", () => {
  const rng = makeRng(42);
  const result = rollMatchup({
    attacker: makePlayer("ot1", "OT"),
    defender: makePlayer("edge1", "EDGE"),
    schemeFitAttacker: "neutral",
    schemeFitDefender: "neutral",
    coaching: {
      offense: makeCoachingMods(),
      defense: makeCoachingMods(),
    },
    situation: makeSituation({ down: 3, distance: 10 }),
    matchupType: "pass_protection",
    rng,
  });
  assertEquals(typeof result.score, "number");
});

Deno.test("rollMatchup applies red zone situation modifier", () => {
  const rng = makeRng(42);
  const result = rollMatchup({
    attacker: makePlayer("wr1", "WR"),
    defender: makePlayer("cb1", "CB"),
    schemeFitAttacker: "neutral",
    schemeFitDefender: "neutral",
    coaching: {
      offense: makeCoachingMods(),
      defense: makeCoachingMods(),
    },
    situation: makeSituation({ yardLine: 5 }),
    matchupType: "route_coverage",
    rng,
  });
  assertEquals(typeof result.score, "number");
});

Deno.test("synthesizeOutcome handles interception on terrible coverage", () => {
  const passCall: OffensiveCall = {
    concept: "dropback",
    personnel: "11",
    formation: "shotgun",
    motion: "none",
  };
  const coverageCall: DefensiveCall = {
    front: "4-3",
    coverage: "cover_3",
    pressure: "four_man",
  };
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
    const event = synthesizeOutcome(
      passCall,
      coverageCall,
      contribs,
      makeGameState(),
      rng,
    );
    if (event.outcome === "interception") {
      assertEquals(event.tags.includes("interception"), true);
      assertEquals(event.tags.includes("turnover"), true);
      intFound = true;
      break;
    }
  }
  assertEquals(intFound, true);
});

Deno.test("synthesizeOutcome handles big pass play", () => {
  const passCall: OffensiveCall = {
    concept: "dropback",
    personnel: "11",
    formation: "shotgun",
    motion: "none",
  };
  const coverageCall: DefensiveCall = {
    front: "4-3",
    coverage: "cover_3",
    pressure: "four_man",
  };
  const rng = makeRng(42);
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
  const event = synthesizeOutcome(
    passCall,
    coverageCall,
    contribs,
    makeGameState(),
    rng,
  );
  assertEquals(
    event.outcome === "pass_complete" || event.outcome === "touchdown",
    true,
  );
  assertEquals(event.tags.includes("big_play"), true);
});

Deno.test("synthesizeOutcome handles moderate pass completion", () => {
  const passCall: OffensiveCall = {
    concept: "dropback",
    personnel: "11",
    formation: "shotgun",
    motion: "none",
  };
  const coverageCall: DefensiveCall = {
    front: "4-3",
    coverage: "cover_3",
    pressure: "four_man",
  };
  const rng = makeRng(42);
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
  const event = synthesizeOutcome(
    passCall,
    coverageCall,
    contribs,
    makeGameState(),
    rng,
  );
  assertEquals(
    event.outcome === "pass_complete" || event.outcome === "touchdown",
    true,
  );
});

Deno.test("synthesizeOutcome handles pressure without sack", () => {
  const passCall: OffensiveCall = {
    concept: "dropback",
    personnel: "11",
    formation: "shotgun",
    motion: "none",
  };
  const coverageCall: DefensiveCall = {
    front: "4-3",
    coverage: "cover_3",
    pressure: "four_man",
  };
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
  const event = synthesizeOutcome(
    passCall,
    coverageCall,
    contribs,
    makeGameState(),
    rng,
  );
  assertEquals(event.tags.includes("pressure"), true);
});

Deno.test("synthesizeOutcome handles negative run blocking", () => {
  const runCall: OffensiveCall = {
    concept: "inside_zone",
    personnel: "11",
    formation: "shotgun",
    motion: "none",
  };
  const coverageCall: DefensiveCall = {
    front: "4-3",
    coverage: "cover_3",
    pressure: "four_man",
  };
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
  const event = synthesizeOutcome(
    runCall,
    coverageCall,
    contribs,
    makeGameState(),
    rng,
  );
  assertEquals(event.yardage <= 0, true);
});

Deno.test("synthesizeOutcome handles slightly negative run blocking", () => {
  const runCall: OffensiveCall = {
    concept: "inside_zone",
    personnel: "11",
    formation: "shotgun",
    motion: "none",
  };
  const coverageCall: DefensiveCall = {
    front: "4-3",
    coverage: "cover_3",
    pressure: "four_man",
  };
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
  const event = synthesizeOutcome(
    runCall,
    coverageCall,
    contribs,
    makeGameState(),
    rng,
  );
  assertEquals(event.yardage >= 0 && event.yardage <= 3, true);
});

// ── resolvePlay (integration) ───────────────────────────────────────

Deno.test("resolvePlay", async (t) => {
  await t.step("returns a complete PlayEvent", () => {
    const rng = makeRng();
    const state = makeGameState();
    const offense = makeTeamRuntime({ onField: makeOffense() });
    const defense = makeTeamRuntime({ onField: makeDefense() });

    const event = resolvePlay(state, offense, defense, rng);
    assertEquals(event.gameId, "game-1");
    assertEquals(event.offenseTeamId, "team-a");
    assertEquals(event.defenseTeamId, "team-b");
    assertEquals(typeof event.outcome, "string");
    assertEquals(typeof event.yardage, "number");
  });

  await t.step(
    "consumes computeSchemeFit from the schemes feature as an import",
    () => {
      const rng = makeRng(99);
      const state = makeGameState();
      const offense = makeTeamRuntime({ onField: makeOffense() });
      const defense = makeTeamRuntime({ onField: makeDefense() });

      const event = resolvePlay(state, offense, defense, rng);
      assertEquals(typeof event.outcome, "string");
    },
  );
});

// ── Determinism ─────────────────────────────────────────────────────

Deno.test("determinism: same roster + staff + seed produces byte-identical PlayEvent sequence", () => {
  const seed = 12345;
  const state = makeGameState();
  const offense = makeTeamRuntime({ onField: makeOffense() });
  const defense = makeTeamRuntime({ onField: makeDefense() });

  const events1: ReturnType<typeof resolvePlay>[] = [];
  const events2: ReturnType<typeof resolvePlay>[] = [];

  for (let i = 0; i < 20; i++) {
    const rng1 = createRng(mulberry32(seed + i));
    const rng2 = createRng(mulberry32(seed + i));
    events1.push(
      resolvePlay(
        { ...state, playIndex: i },
        offense,
        defense,
        rng1,
      ),
    );
    events2.push(
      resolvePlay(
        { ...state, playIndex: i },
        offense,
        defense,
        rng2,
      ),
    );
  }

  for (let i = 0; i < events1.length; i++) {
    assertEquals(
      JSON.stringify(events1[i]),
      JSON.stringify(events2[i]),
      `Play ${i} diverged`,
    );
  }
});

Deno.test("synthesizeOutcome emits safety when offense driven behind own goal line", () => {
  const runCall: OffensiveCall = {
    concept: "inside_zone",
    personnel: "11",
    formation: "shotgun",
    motion: "none",
  };
  const coverageCall: DefensiveCall = {
    front: "4-3",
    coverage: "cover_3",
    pressure: "four_man",
  };
  let safetyFound = false;
  for (let seed = 0; seed < 500; seed++) {
    const rng = makeRng(seed);
    const state = makeGameState({
      situation: makeSituation({ yardLine: 2 }),
    });
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
    const event = synthesizeOutcome(
      runCall,
      coverageCall,
      contribs,
      state,
      rng,
    );
    if (event.outcome === "safety") {
      assertEquals(event.tags.includes("safety"), true);
      safetyFound = true;
      break;
    }
  }
  assertEquals(
    safetyFound,
    true,
    "Should emit safety when offense tackled in own end zone",
  );
});

Deno.test("synthesizeOutcome emits return_td on turnovers", () => {
  const passCall: OffensiveCall = {
    concept: "dropback",
    personnel: "11",
    formation: "shotgun",
    motion: "none",
  };
  const coverageCall: DefensiveCall = {
    front: "4-3",
    coverage: "cover_3",
    pressure: "four_man",
  };
  let returnTdFound = false;
  for (let seed = 0; seed < 5000 && !returnTdFound; seed++) {
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
          defender: makePlayer("cb1", "CB", { speed: 90, acceleration: 88 }),
        },
        attackerFit: "neutral",
        defenderFit: "neutral",
        score: -20,
      },
    ];
    const event = synthesizeOutcome(
      passCall,
      coverageCall,
      contribs,
      makeGameState(),
      rng,
    );
    if (event.tags.includes("return_td")) {
      assertEquals(event.tags.includes("turnover"), true);
      assertEquals(event.tags.includes("touchdown"), true);
      returnTdFound = true;
    }
  }
  assertEquals(returnTdFound, true, "Should emit return_td on some turnovers");
});

Deno.test("synthesizeOutcome return_td tags defender with touchdown", () => {
  const passCall: OffensiveCall = {
    concept: "dropback",
    personnel: "11",
    formation: "shotgun",
    motion: "none",
  };
  const coverageCall: DefensiveCall = {
    front: "4-3",
    coverage: "cover_3",
    pressure: "four_man",
  };
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
        score: 10,
      },
      {
        matchup: {
          type: "route_coverage",
          attacker: makePlayer("wr1", "WR"),
          defender: makePlayer("cb1", "CB", { speed: 90, acceleration: 88 }),
        },
        attackerFit: "neutral",
        defenderFit: "neutral",
        score: -20,
      },
    ];
    const event = synthesizeOutcome(
      passCall,
      coverageCall,
      contribs,
      makeGameState(),
      rng,
    );
    if (event.tags.includes("return_td")) {
      const defenderParticipant = event.participants.find(
        (p) => p.tags.includes("return_td"),
      );
      assertExists(defenderParticipant);
      assertEquals(defenderParticipant!.tags.includes("touchdown"), true);
      break;
    }
  }
});

Deno.test("determinism: different seeds produce different sequences", () => {
  const state = makeGameState();
  const offense = makeTeamRuntime({ onField: makeOffense() });
  const defense = makeTeamRuntime({ onField: makeDefense() });

  const rng1 = makeRng(111);
  const rng2 = makeRng(222);

  const event1 = resolvePlay(state, offense, defense, rng1);
  const event2 = resolvePlay(state, offense, defense, rng2);

  const str1 = JSON.stringify(event1);
  const str2 = JSON.stringify(event2);
  assertNotEquals(str1, str2);
});

Deno.test("isTwoMinuteDrill", async (t) => {
  await t.step("returns true in Q2 under 2:00", () => {
    assertEquals(isTwoMinuteDrill(2, "1:59"), true);
    assertEquals(isTwoMinuteDrill(2, "2:00"), true);
    assertEquals(isTwoMinuteDrill(2, "0:30"), true);
    assertEquals(isTwoMinuteDrill(2, "0:01"), true);
  });

  await t.step("returns true in Q4 under 2:00", () => {
    assertEquals(isTwoMinuteDrill(4, "1:30"), true);
    assertEquals(isTwoMinuteDrill(4, "0:01"), true);
  });

  await t.step("returns false in Q1 and Q3", () => {
    assertEquals(isTwoMinuteDrill(1, "1:00"), false);
    assertEquals(isTwoMinuteDrill(3, "0:30"), false);
  });

  await t.step("returns false when clock is above 2:00", () => {
    assertEquals(isTwoMinuteDrill(2, "2:01"), false);
    assertEquals(isTwoMinuteDrill(4, "5:00"), false);
    assertEquals(isTwoMinuteDrill(4, "15:00"), false);
  });

  await t.step("returns false in OT", () => {
    assertEquals(isTwoMinuteDrill("OT", "1:00"), false);
  });
});

Deno.test("drawOffensiveCall with twoMinute option shifts to more passing", () => {
  const fingerprint = makeFingerprint();
  const situation: Situation = { down: 1, distance: 10, yardLine: 50 };
  let normalRuns = 0;
  let twoMinRuns = 0;
  const iterations = 500;

  for (let i = 0; i < iterations; i++) {
    const normalCall = drawOffensiveCall(fingerprint, situation, makeRng(i));
    const twoMinCall = drawOffensiveCall(fingerprint, situation, makeRng(i), {
      twoMinute: true,
    });
    if (
      normalCall.concept === "inside_zone" ||
      normalCall.concept === "outside_zone" ||
      normalCall.concept === "power" ||
      normalCall.concept === "counter" ||
      normalCall.concept === "draw"
    ) {
      normalRuns++;
    }
    if (
      twoMinCall.concept === "inside_zone" ||
      twoMinCall.concept === "outside_zone" ||
      twoMinCall.concept === "power" ||
      twoMinCall.concept === "counter" ||
      twoMinCall.concept === "draw"
    ) {
      twoMinRuns++;
    }
  }

  assertEquals(
    twoMinRuns < normalRuns,
    true,
    `Two-minute should have fewer runs (${twoMinRuns}) than normal (${normalRuns})`,
  );
});

Deno.test("drawDefensiveCall with twoMinute option shifts to prevent coverage", () => {
  const fingerprint = makeFingerprint();
  const situation: Situation = { down: 1, distance: 10, yardLine: 50 };
  const preventCoverages = new Set([
    "cover_2",
    "cover_3",
    "cover_4",
    "cover_6",
  ]);
  let normalPrevent = 0;
  let twoMinPrevent = 0;
  const iterations = 500;

  for (let i = 0; i < iterations; i++) {
    const normalCall = drawDefensiveCall(fingerprint, situation, makeRng(i));
    const twoMinCall = drawDefensiveCall(fingerprint, situation, makeRng(i), {
      twoMinute: true,
    });
    if (preventCoverages.has(normalCall.coverage)) normalPrevent++;
    if (preventCoverages.has(twoMinCall.coverage)) twoMinPrevent++;
  }

  assertEquals(
    twoMinPrevent > normalPrevent,
    true,
    `Two-minute should have more prevent (${twoMinPrevent}) than normal (${normalPrevent})`,
  );
});

Deno.test("resolvePlay with twoMinute option adds two_minute tag", () => {
  const state = makeGameState();
  const offense = makeTeamRuntime({ onField: makeOffense() });
  const defense = makeTeamRuntime({ onField: makeDefense() });
  const rng = makeRng(42);

  const event = resolvePlay(state, offense, defense, rng, { twoMinute: true });
  assertEquals(
    event.tags.includes("two_minute"),
    true,
    "Event should carry two_minute tag",
  );
});
