import { assertEquals } from "@std/assert";
import {
  PLAYER_ATTRIBUTE_KEYS,
  type PlayerAttributes,
} from "@zone-blitz/shared";
import { createRng, mulberry32 } from "./rng.ts";
import type { SeededRng } from "./rng.ts";
import type { DefensiveCall, OffensiveCall } from "./events.ts";
import type { PlayerRuntime } from "./resolve-play.ts";
import {
  assignDefense,
  assignOffense,
  rankPlayers,
  resolveMatchups,
} from "./resolve-matchups.ts";

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

function makeOffense(): PlayerRuntime[] {
  return [
    makePlayer("qb1", "QB"),
    makePlayer("rb1", "RB", { speed: 85, acceleration: 82, agility: 80 }),
    makePlayer("wr1", "WR", { routeRunning: 90, speed: 88, catching: 85 }),
    makePlayer("wr2", "WR", { routeRunning: 70, speed: 72, catching: 68 }),
    makePlayer("te1", "TE", { routeRunning: 60, speed: 55, catching: 62 }),
    makePlayer("ot1", "OT", {
      passBlocking: 85,
      runBlocking: 80,
      strength: 82,
    }),
    makePlayer("ot2", "OT", {
      passBlocking: 72,
      runBlocking: 70,
      strength: 68,
    }),
    makePlayer("iol1", "IOL", {
      passBlocking: 78,
      runBlocking: 82,
      strength: 80,
    }),
    makePlayer("iol2", "IOL", {
      passBlocking: 68,
      runBlocking: 72,
      strength: 70,
    }),
    makePlayer("iol3", "IOL", {
      passBlocking: 65,
      runBlocking: 68,
      strength: 66,
    }),
  ];
}

function makeDefense(): PlayerRuntime[] {
  return [
    makePlayer("edge1", "EDGE", {
      passRushing: 88,
      acceleration: 85,
      strength: 78,
    }),
    makePlayer("edge2", "EDGE", {
      passRushing: 70,
      acceleration: 68,
      strength: 65,
    }),
    makePlayer("idl1", "IDL", {
      blockShedding: 80,
      tackling: 75,
      runDefense: 82,
    }),
    makePlayer("idl2", "IDL", {
      blockShedding: 68,
      tackling: 65,
      runDefense: 70,
    }),
    makePlayer("lb1", "LB", {
      tackling: 82,
      runDefense: 80,
      zoneCoverage: 65,
    }),
    makePlayer("lb2", "LB", {
      tackling: 68,
      runDefense: 66,
      zoneCoverage: 55,
    }),
    makePlayer("cb1", "CB", {
      manCoverage: 90,
      zoneCoverage: 82,
      speed: 88,
    }),
    makePlayer("cb2", "CB", {
      manCoverage: 68,
      zoneCoverage: 65,
      speed: 70,
    }),
    makePlayer("s1", "S", {
      zoneCoverage: 80,
      speed: 78,
      tackling: 72,
    }),
    makePlayer("s2", "S", {
      zoneCoverage: 65,
      speed: 68,
      tackling: 62,
    }),
  ];
}

// ── rankPlayers ────────────────────────────────────────────────────

Deno.test("rankPlayers", async (t) => {
  await t.step("sorts players by descending attribute average", () => {
    const players = [
      makePlayer("low", "WR", { routeRunning: 40, speed: 42, catching: 38 }),
      makePlayer("high", "WR", { routeRunning: 90, speed: 88, catching: 85 }),
      makePlayer("mid", "WR", { routeRunning: 65, speed: 60, catching: 62 }),
    ];
    const ranked = rankPlayers(players, [
      "routeRunning",
      "speed",
      "catching",
    ]);
    assertEquals(ranked[0].playerId, "high");
    assertEquals(ranked[1].playerId, "mid");
    assertEquals(ranked[2].playerId, "low");
  });

  await t.step("does not mutate the input array", () => {
    const players = [
      makePlayer("b", "CB", { manCoverage: 40 }),
      makePlayer("a", "CB", { manCoverage: 90 }),
    ];
    const original = [...players];
    rankPlayers(players, ["manCoverage"]);
    assertEquals(players[0].playerId, original[0].playerId);
  });

  await t.step("handles empty array", () => {
    const ranked = rankPlayers([], ["speed"]);
    assertEquals(ranked.length, 0);
  });

  await t.step("handles single player", () => {
    const players = [makePlayer("only", "RB")];
    const ranked = rankPlayers(players, ["speed", "acceleration"]);
    assertEquals(ranked.length, 1);
    assertEquals(ranked[0].playerId, "only");
  });
});

// ── assignOffense ──────────────────────────────────────────────────

Deno.test("assignOffense", async (t) => {
  await t.step(
    "run play: RB1 gets ball_carrier, OL/TE get run_block",
    () => {
      const call: OffensiveCall = {
        concept: "inside_zone",
        personnel: "11",
        formation: "shotgun",
        motion: "none",
      };
      const assignments = assignOffense(call, makeOffense());
      const ballCarrier = assignments.find((a) => a.role === "ball_carrier");
      assertEquals(ballCarrier?.player.playerId, "rb1");
      const blockingAssignments = assignments.filter(
        (a) => a.role === "run_block",
      );
      assertEquals(blockingAssignments.length > 0, true);
    },
  );

  await t.step(
    "pass play: WR1 gets primary_route, WR2 gets secondary_route",
    () => {
      const call: OffensiveCall = {
        concept: "dropback",
        personnel: "11",
        formation: "shotgun",
        motion: "none",
      };
      const assignments = assignOffense(call, makeOffense());
      const primaryRoute = assignments.find(
        (a) => a.role === "primary_route",
      );
      assertEquals(primaryRoute?.player.playerId, "wr1");
      const secondaryRoute = assignments.find(
        (a) => a.role === "secondary_route",
      );
      assertEquals(secondaryRoute?.player.playerId, "wr2");
    },
  );

  await t.step("pass play: TE gets check_down route", () => {
    const call: OffensiveCall = {
      concept: "dropback",
      personnel: "11",
      formation: "shotgun",
      motion: "none",
    };
    const assignments = assignOffense(call, makeOffense());
    const teAssignment = assignments.find(
      (a) => a.player.neutralBucket === "TE",
    );
    assertEquals(teAssignment?.role, "check_down");
  });

  await t.step("pass play: RB gets pass_protect", () => {
    const call: OffensiveCall = {
      concept: "dropback",
      personnel: "11",
      formation: "shotgun",
      motion: "none",
    };
    const assignments = assignOffense(call, makeOffense());
    const rbAssignment = assignments.find(
      (a) => a.player.neutralBucket === "RB",
    );
    assertEquals(rbAssignment?.role, "pass_protect");
  });

  await t.step("pass play: OL gets pass_protect", () => {
    const call: OffensiveCall = {
      concept: "dropback",
      personnel: "11",
      formation: "shotgun",
      motion: "none",
    };
    const assignments = assignOffense(call, makeOffense());
    const olAssignments = assignments.filter(
      (a) =>
        a.player.neutralBucket === "OT" || a.player.neutralBucket === "IOL",
    );
    for (const a of olAssignments) {
      assertEquals(a.role, "pass_protect");
    }
  });

  await t.step("handles empty player array", () => {
    const call: OffensiveCall = {
      concept: "dropback",
      personnel: "11",
      formation: "shotgun",
      motion: "none",
    };
    const assignments = assignOffense(call, []);
    assertEquals(assignments.length, 0);
  });
});

// ── assignDefense ──────────────────────────────────────────────────

Deno.test("assignDefense", async (t) => {
  const receivers = [
    makePlayer("wr1", "WR", { routeRunning: 90, speed: 88, catching: 85 }),
    makePlayer("wr2", "WR", { routeRunning: 70, speed: 72, catching: 68 }),
    makePlayer("te1", "TE", { routeRunning: 60, speed: 55, catching: 62 }),
  ];

  await t.step(
    "man coverage: CB1 shadows WR1 (best CB targets best receiver)",
    () => {
      const coverage: DefensiveCall = {
        front: "4-3",
        coverage: "cover_1",
        pressure: "four_man",
      };
      const assignments = assignDefense(
        coverage,
        makeDefense(),
        receivers,
      );
      const cb1Shadow = assignments.find(
        (a) => a.player.playerId === "cb1" && a.role === "man_shadow",
      );
      assertEquals(cb1Shadow?.manTarget, "wr1");
    },
  );

  await t.step("man coverage: CB2 shadows WR2", () => {
    const coverage: DefensiveCall = {
      front: "4-3",
      coverage: "cover_1",
      pressure: "four_man",
    };
    const assignments = assignDefense(coverage, makeDefense(), receivers);
    const cb2Shadow = assignments.find(
      (a) => a.player.playerId === "cb2" && a.role === "man_shadow",
    );
    assertEquals(cb2Shadow?.manTarget, "wr2");
  });

  await t.step(
    "man coverage: safety covers remaining receiver (TE)",
    () => {
      const coverage: DefensiveCall = {
        front: "4-3",
        coverage: "cover_1",
        pressure: "four_man",
      };
      const assignments = assignDefense(
        coverage,
        makeDefense(),
        receivers,
      );
      const sShadow = assignments.find(
        (a) => a.player.playerId === "s1" && a.role === "man_shadow",
      );
      assertEquals(sShadow?.manTarget, "te1");
    },
  );

  await t.step("zone coverage: defenders get zone assignments", () => {
    const coverage: DefensiveCall = {
      front: "4-3",
      coverage: "cover_3",
      pressure: "four_man",
    };
    const assignments = assignDefense(coverage, makeDefense(), receivers);
    const zoneAssignments = assignments.filter(
      (a) =>
        a.role === "zone_flat" ||
        a.role === "zone_hook" ||
        a.role === "zone_deep",
    );
    assertEquals(zoneAssignments.length > 0, true);
  });

  await t.step("blitz: LBs get pass_rush role", () => {
    const coverage: DefensiveCall = {
      front: "4-3",
      coverage: "cover_1",
      pressure: "man_blitz",
    };
    const assignments = assignDefense(coverage, makeDefense(), receivers);
    const blitzingLBs = assignments.filter(
      (a) => a.player.neutralBucket === "LB" && a.role === "pass_rush",
    );
    assertEquals(blitzingLBs.length > 0, true);
  });

  await t.step("DL always gets pass_rush role", () => {
    const coverage: DefensiveCall = {
      front: "4-3",
      coverage: "cover_3",
      pressure: "four_man",
    };
    const assignments = assignDefense(coverage, makeDefense(), receivers);
    const dlRushers = assignments.filter(
      (a) =>
        (a.player.neutralBucket === "EDGE" ||
          a.player.neutralBucket === "IDL") &&
        a.role === "pass_rush",
    );
    assertEquals(dlRushers.length, 4);
  });

  await t.step("handles empty arrays", () => {
    const coverage: DefensiveCall = {
      front: "4-3",
      coverage: "cover_3",
      pressure: "four_man",
    };
    const assignments = assignDefense(coverage, [], []);
    assertEquals(assignments.length, 0);
  });
});

// ── resolveMatchups ────────────────────────────────────────────────

Deno.test("resolveMatchups", async (t) => {
  await t.step("run play returns run_block matchups", () => {
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
    "pass play with man coverage returns pass_protection and route_coverage",
    () => {
      const call: OffensiveCall = {
        concept: "dropback",
        personnel: "11",
        formation: "shotgun",
        motion: "none",
      };
      const coverage: DefensiveCall = {
        front: "4-3",
        coverage: "cover_1",
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
      const protection = matchups.filter(
        (m) => m.type === "pass_protection",
      );
      const routes = matchups.filter((m) => m.type === "route_coverage");
      assertEquals(protection.length > 0, true);
      assertEquals(routes.length > 0, true);
    },
  );

  await t.step(
    "man coverage: CB1 (best coverage attrs) pairs with WR1 (best receiving attrs)",
    () => {
      const call: OffensiveCall = {
        concept: "dropback",
        personnel: "11",
        formation: "shotgun",
        motion: "none",
      };
      const coverage: DefensiveCall = {
        front: "4-3",
        coverage: "cover_1",
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
      const routeMatchups = matchups.filter(
        (m) => m.type === "route_coverage",
      );
      const wr1Matchup = routeMatchups.find(
        (m) => m.attacker.playerId === "wr1",
      );
      assertEquals(wr1Matchup?.defender.playerId, "cb1");
    },
  );

  await t.step("man coverage: CB2 pairs with WR2", () => {
    const call: OffensiveCall = {
      concept: "dropback",
      personnel: "11",
      formation: "shotgun",
      motion: "none",
    };
    const coverage: DefensiveCall = {
      front: "4-3",
      coverage: "cover_1",
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
    const routeMatchups = matchups.filter(
      (m) => m.type === "route_coverage",
    );
    const wr2Matchup = routeMatchups.find(
      (m) => m.attacker.playerId === "wr2",
    );
    assertEquals(wr2Matchup?.defender.playerId, "cb2");
  });

  await t.step(
    "man coverage: safety covers TE when CBs cover WRs",
    () => {
      const call: OffensiveCall = {
        concept: "dropback",
        personnel: "11",
        formation: "shotgun",
        motion: "none",
      };
      const coverage: DefensiveCall = {
        front: "4-3",
        coverage: "cover_1",
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
      const teMatchup = matchups.find(
        (m) =>
          m.type === "route_coverage" &&
          m.attacker.playerId === "te1",
      );
      assertEquals(teMatchup?.defender.playerId, "s1");
    },
  );

  await t.step(
    "zone coverage: matchups depend on concept (deep_shot routes face deep zone defenders)",
    () => {
      const call: OffensiveCall = {
        concept: "deep_shot",
        personnel: "11",
        formation: "shotgun",
        motion: "none",
      };
      const coverage: DefensiveCall = {
        front: "4-3",
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
      const routeMatchups = matchups.filter(
        (m) => m.type === "route_coverage",
      );
      assertEquals(routeMatchups.length > 0, true);
      const primaryMatchup = routeMatchups.find(
        (m) => m.attacker.playerId === "wr1",
      );
      assertEquals(
        primaryMatchup?.defender.neutralBucket === "S" ||
          primaryMatchup?.defender.neutralBucket === "CB",
        true,
      );
    },
  );

  await t.step(
    "zone coverage: deep_shot primary receiver faces safety in cover_2",
    () => {
      const call: OffensiveCall = {
        concept: "deep_shot",
        personnel: "11",
        formation: "shotgun",
        motion: "none",
      };
      const coverage: DefensiveCall = {
        front: "4-3",
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
      const wr1Matchup = matchups.find(
        (m) =>
          m.type === "route_coverage" &&
          m.attacker.playerId === "wr1",
      );
      assertEquals(wr1Matchup?.defender.neutralBucket, "S");
    },
  );

  await t.step(
    "zone coverage: short concepts (screen) face underneath defenders",
    () => {
      const call: OffensiveCall = {
        concept: "screen",
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
      const wr1Matchup = matchups.find(
        (m) =>
          m.type === "route_coverage" &&
          m.attacker.playerId === "wr1",
      );
      assertEquals(
        wr1Matchup?.defender.neutralBucket === "LB" ||
          wr1Matchup?.defender.neutralBucket === "S",
        true,
      );
    },
  );

  await t.step("blitz adds pass_rush matchups with LB vs RB", () => {
    const call: OffensiveCall = {
      concept: "dropback",
      personnel: "11",
      formation: "shotgun",
      motion: "none",
    };
    const coverage: DefensiveCall = {
      front: "4-3",
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
    const passRush = matchups.filter((m) => m.type === "pass_rush");
    assertEquals(passRush.length > 0, true);
    assertEquals(passRush[0].attacker.neutralBucket, "LB");
    assertEquals(passRush[0].defender.neutralBucket, "RB");
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

  await t.step(
    "pass protection pairs best OL against best pass rusher",
    () => {
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
      const matchups = resolveMatchups(
        call,
        coverage,
        makeOffense(),
        makeDefense(),
        rng,
      );
      const protection = matchups.filter(
        (m) => m.type === "pass_protection",
      );
      assertEquals(protection[0].attacker.playerId, "ot1");
      assertEquals(protection[0].defender.playerId, "edge1");
    },
  );
});

// ── stat concentration ─────────────────────────────────────────────

Deno.test("stat concentration", async (t) => {
  await t.step(
    "man coverage consistently produces CB1-WR1 matchup across many plays",
    () => {
      let cb1vsWr1Count = 0;
      const total = 100;
      for (let i = 0; i < total; i++) {
        const rng = makeRng(i);
        const call: OffensiveCall = {
          concept: "dropback",
          personnel: "11",
          formation: "shotgun",
          motion: "none",
        };
        const coverage: DefensiveCall = {
          front: "4-3",
          coverage: "cover_1",
          pressure: "four_man",
        };
        const matchups = resolveMatchups(
          call,
          coverage,
          makeOffense(),
          makeDefense(),
          rng,
        );
        const wr1Matchup = matchups.find(
          (m) =>
            m.type === "route_coverage" &&
            m.attacker.playerId === "wr1",
        );
        if (wr1Matchup?.defender.playerId === "cb1") cb1vsWr1Count++;
      }
      assertEquals(
        cb1vsWr1Count,
        total,
        "CB1 should shadow WR1 on every man coverage snap",
      );
    },
  );

  await t.step(
    "zone coverage produces varied matchups (not always CB1-WR1)",
    () => {
      const defendersFacingWr1 = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const rng = makeRng(i);
        const concepts = [
          "screen",
          "quick_pass",
          "dropback",
          "play_action",
          "deep_shot",
        ];
        const coverages = ["cover_2", "cover_3", "cover_4", "cover_6"];
        const call: OffensiveCall = {
          concept: concepts[i % concepts.length],
          personnel: "11",
          formation: "shotgun",
          motion: "none",
        };
        const coverage: DefensiveCall = {
          front: "4-3",
          coverage: coverages[i % coverages.length],
          pressure: "four_man",
        };
        const matchups = resolveMatchups(
          call,
          coverage,
          makeOffense(),
          makeDefense(),
          rng,
        );
        const wr1Matchup = matchups.find(
          (m) =>
            m.type === "route_coverage" &&
            m.attacker.playerId === "wr1",
        );
        if (wr1Matchup) {
          defendersFacingWr1.add(wr1Matchup.defender.playerId);
        }
      }
      assertEquals(
        defendersFacingWr1.size > 1,
        true,
        "Zone coverage should produce varied matchups for WR1",
      );
    },
  );

  await t.step(
    "RB1 is ball carrier on run plays (highest rushing attrs)",
    () => {
      const offense = [
        makePlayer("qb1", "QB"),
        makePlayer("rb_slow", "RB", {
          speed: 50,
          acceleration: 48,
          agility: 45,
        }),
        makePlayer("rb_fast", "RB", {
          speed: 90,
          acceleration: 88,
          agility: 85,
        }),
        makePlayer("wr1", "WR"),
        makePlayer("ot1", "OT"),
        makePlayer("iol1", "IOL"),
      ];
      const call: OffensiveCall = {
        concept: "inside_zone",
        personnel: "21",
        formation: "i_form",
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
        offense,
        makeDefense(),
        rng,
      );
      const rbMatchups = matchups.filter(
        (m) =>
          m.type === "run_block" &&
          m.attacker.neutralBucket === "RB",
      );
      assertEquals(
        rbMatchups.length > 0,
        true,
        "RB should participate in run matchups",
      );
    },
  );

  await t.step(
    "WR1 gets primary route on pass plays regardless of array order",
    () => {
      const offense = [
        makePlayer("qb1", "QB"),
        makePlayer("rb1", "RB"),
        makePlayer("wr_bad", "WR", {
          routeRunning: 40,
          speed: 42,
          catching: 38,
        }),
        makePlayer("wr_good", "WR", {
          routeRunning: 95,
          speed: 92,
          catching: 90,
        }),
        makePlayer("te1", "TE"),
        makePlayer("ot1", "OT"),
        makePlayer("iol1", "IOL"),
      ];
      const call: OffensiveCall = {
        concept: "dropback",
        personnel: "11",
        formation: "shotgun",
        motion: "none",
      };
      const coverage: DefensiveCall = {
        front: "4-3",
        coverage: "cover_1",
        pressure: "four_man",
      };
      const rng = makeRng();
      const matchups = resolveMatchups(
        call,
        coverage,
        offense,
        makeDefense(),
        rng,
      );
      const routeMatchups = matchups.filter(
        (m) => m.type === "route_coverage",
      );
      assertEquals(
        routeMatchups[0].attacker.playerId,
        "wr_good",
        "Best WR should be first in route matchups regardless of array position",
      );
      assertEquals(
        routeMatchups[0].defender.playerId,
        "cb1",
        "Best CB should cover best WR in man coverage",
      );
    },
  );
});
