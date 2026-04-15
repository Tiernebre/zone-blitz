import { assertEquals, assertGreater } from "@std/assert";
import {
  PLAYER_ATTRIBUTE_KEYS,
  type PlayerAttributes,
  type SchemeFingerprint,
} from "@zone-blitz/shared";
import type { PlayEvent } from "./events.ts";
import type { CoachingMods, PlayerRuntime } from "./resolve-play.ts";
import type { SimTeam } from "./simulate-game.ts";
import { simulateGame } from "./simulate-game.ts";
import {
  deriveBoxScore,
  deriveDriveLog,
  deriveInjuryReport,
} from "./derive-game-views.ts";

function makeEvent(overrides: Partial<PlayEvent> = {}): PlayEvent {
  return {
    gameId: "game-1",
    driveIndex: 0,
    playIndex: 0,
    quarter: 1,
    clock: "15:00",
    situation: { down: 1, distance: 10, yardLine: 25 },
    offenseTeamId: "team-home",
    defenseTeamId: "team-away",
    call: {
      concept: "inside_zone",
      personnel: "11",
      formation: "shotgun",
      motion: "none",
    },
    coverage: { front: "4-3", coverage: "cover_3", pressure: "base" },
    participants: [],
    outcome: "rush",
    yardage: 5,
    tags: [],
    ...overrides,
  };
}

Deno.test("deriveBoxScore", async (t) => {
  await t.step("is a pure function — same input yields same output", () => {
    const events: PlayEvent[] = [
      makeEvent({ outcome: "rush", yardage: 10, offenseTeamId: "team-home" }),
      makeEvent({
        outcome: "pass_complete",
        yardage: 15,
        offenseTeamId: "team-away",
        defenseTeamId: "team-home",
      }),
    ];
    const a = deriveBoxScore(events, "team-home", "team-away");
    const b = deriveBoxScore(events, "team-home", "team-away");
    assertEquals(a, b);
  });

  await t.step("tallies rushing yards for home and away", () => {
    const events: PlayEvent[] = [
      makeEvent({ outcome: "rush", yardage: 10, offenseTeamId: "team-home" }),
      makeEvent({ outcome: "rush", yardage: 7, offenseTeamId: "team-home" }),
      makeEvent({
        outcome: "rush",
        yardage: 4,
        offenseTeamId: "team-away",
        defenseTeamId: "team-home",
      }),
    ];
    const box = deriveBoxScore(events, "team-home", "team-away");
    assertEquals(box.home.rushingYards, 17);
    assertEquals(box.away.rushingYards, 4);
  });

  await t.step("tallies passing yards including sacks", () => {
    const events: PlayEvent[] = [
      makeEvent({
        outcome: "pass_complete",
        yardage: 20,
        offenseTeamId: "team-home",
      }),
      makeEvent({
        outcome: "sack",
        yardage: -7,
        offenseTeamId: "team-home",
        tags: ["sack"],
      }),
      makeEvent({
        outcome: "pass_complete",
        yardage: 12,
        offenseTeamId: "team-away",
        defenseTeamId: "team-home",
      }),
    ];
    const box = deriveBoxScore(events, "team-home", "team-away");
    assertEquals(box.home.passingYards, 13);
    assertEquals(box.away.passingYards, 12);
  });

  await t.step("tallies total yards from rush, pass, sack, touchdown", () => {
    const events: PlayEvent[] = [
      makeEvent({ outcome: "rush", yardage: 10, offenseTeamId: "team-home" }),
      makeEvent({
        outcome: "pass_complete",
        yardage: 20,
        offenseTeamId: "team-home",
      }),
      makeEvent({
        outcome: "sack",
        yardage: -5,
        offenseTeamId: "team-home",
        tags: ["sack"],
      }),
      makeEvent({
        outcome: "touchdown",
        yardage: 3,
        offenseTeamId: "team-home",
        tags: ["touchdown"],
      }),
    ];
    const box = deriveBoxScore(events, "team-home", "team-away");
    assertEquals(box.home.totalYards, 28);
  });

  await t.step("counts turnovers from turnover tags", () => {
    const events: PlayEvent[] = [
      makeEvent({
        outcome: "interception",
        yardage: 0,
        offenseTeamId: "team-home",
        tags: ["turnover", "interception"],
      }),
      makeEvent({
        outcome: "fumble",
        yardage: 0,
        offenseTeamId: "team-away",
        defenseTeamId: "team-home",
        tags: ["turnover", "fumble"],
      }),
    ];
    const box = deriveBoxScore(events, "team-home", "team-away");
    assertEquals(box.home.turnovers, 1);
    assertEquals(box.away.turnovers, 1);
  });

  await t.step("counts sacks for the defense", () => {
    const events: PlayEvent[] = [
      makeEvent({
        outcome: "sack",
        yardage: -8,
        offenseTeamId: "team-home",
        defenseTeamId: "team-away",
        tags: ["sack"],
      }),
    ];
    const box = deriveBoxScore(events, "team-home", "team-away");
    assertEquals(box.away.sacks, 1);
    assertEquals(box.home.sacks, 0);
  });

  await t.step("counts penalties for the offense", () => {
    const events: PlayEvent[] = [
      makeEvent({
        outcome: "penalty",
        yardage: -5,
        offenseTeamId: "team-home",
        tags: ["penalty"],
      }),
      makeEvent({
        outcome: "rush",
        yardage: 3,
        offenseTeamId: "team-away",
        defenseTeamId: "team-home",
        tags: ["penalty"],
      }),
    ];
    const box = deriveBoxScore(events, "team-home", "team-away");
    assertEquals(box.home.penalties, 1);
    assertEquals(box.away.penalties, 1);
  });

  await t.step("returns zeroes for empty event stream", () => {
    const box = deriveBoxScore([], "team-home", "team-away");
    assertEquals(box.home.totalYards, 0);
    assertEquals(box.home.passingYards, 0);
    assertEquals(box.home.rushingYards, 0);
    assertEquals(box.home.turnovers, 0);
    assertEquals(box.home.sacks, 0);
    assertEquals(box.home.penalties, 0);
    assertEquals(box.away.totalYards, 0);
  });
});

Deno.test("deriveDriveLog", async (t) => {
  await t.step("groups events by driveIndex into drives", () => {
    const events: PlayEvent[] = [
      makeEvent({ driveIndex: 0, playIndex: 0, yardage: 5 }),
      makeEvent({ driveIndex: 0, playIndex: 1, yardage: 3 }),
      makeEvent({
        driveIndex: 1,
        playIndex: 0,
        offenseTeamId: "team-away",
        defenseTeamId: "team-home",
        yardage: 7,
        outcome: "punt",
      }),
    ];
    const log = deriveDriveLog(events);
    assertEquals(log.length, 2);
    assertEquals(log[0].driveIndex, 0);
    assertEquals(log[1].driveIndex, 1);
  });

  await t.step("captures start yard line from first play", () => {
    const events: PlayEvent[] = [
      makeEvent({
        driveIndex: 0,
        playIndex: 0,
        situation: { down: 1, distance: 10, yardLine: 30 },
      }),
      makeEvent({
        driveIndex: 0,
        playIndex: 1,
        situation: { down: 2, distance: 5, yardLine: 35 },
      }),
    ];
    const log = deriveDriveLog(events);
    assertEquals(log[0].startYardLine, 30);
  });

  await t.step("counts plays per drive", () => {
    const events: PlayEvent[] = [
      makeEvent({ driveIndex: 0, playIndex: 0, yardage: 5 }),
      makeEvent({ driveIndex: 0, playIndex: 1, yardage: 3 }),
      makeEvent({ driveIndex: 0, playIndex: 2, yardage: -2, outcome: "punt" }),
    ];
    const log = deriveDriveLog(events);
    assertEquals(log[0].plays, 3);
  });

  await t.step("sums yards per drive", () => {
    const events: PlayEvent[] = [
      makeEvent({ driveIndex: 0, playIndex: 0, yardage: 10 }),
      makeEvent({ driveIndex: 0, playIndex: 1, yardage: -3 }),
      makeEvent({ driveIndex: 0, playIndex: 2, yardage: 7 }),
    ];
    const log = deriveDriveLog(events);
    assertEquals(log[0].yards, 14);
  });

  await t.step("identifies touchdown drives", () => {
    const events: PlayEvent[] = [
      makeEvent({ driveIndex: 0, playIndex: 0, yardage: 10 }),
      makeEvent({
        driveIndex: 0,
        playIndex: 1,
        outcome: "touchdown",
        yardage: 5,
        tags: ["touchdown"],
      }),
    ];
    const log = deriveDriveLog(events);
    assertEquals(log[0].result, "touchdown");
  });

  await t.step("identifies field goal drives", () => {
    const events: PlayEvent[] = [
      makeEvent({ driveIndex: 0, playIndex: 0, yardage: 15 }),
      makeEvent({
        driveIndex: 0,
        playIndex: 1,
        outcome: "field_goal",
        yardage: 0,
        call: {
          concept: "field_goal",
          personnel: "special_teams",
          formation: "field_goal",
          motion: "none",
        },
      }),
    ];
    const log = deriveDriveLog(events);
    assertEquals(log[0].result, "field_goal");
  });

  await t.step("identifies missed field goal drives by call concept", () => {
    const events: PlayEvent[] = [
      makeEvent({ driveIndex: 0, playIndex: 0, yardage: 15 }),
      makeEvent({
        driveIndex: 0,
        playIndex: 1,
        outcome: "pass_incomplete",
        yardage: 0,
        call: {
          concept: "field_goal",
          personnel: "special_teams",
          formation: "field_goal",
          motion: "none",
        },
        tags: ["penalty"],
      }),
    ];
    const log = deriveDriveLog(events);
    assertEquals(log[0].result, "field_goal");
  });

  await t.step("identifies punt drives", () => {
    const events: PlayEvent[] = [
      makeEvent({ driveIndex: 0, playIndex: 0, yardage: 2 }),
      makeEvent({
        driveIndex: 0,
        playIndex: 1,
        outcome: "punt",
        yardage: 45,
      }),
    ];
    const log = deriveDriveLog(events);
    assertEquals(log[0].result, "punt");
  });

  await t.step("identifies turnover drives", () => {
    const events: PlayEvent[] = [
      makeEvent({ driveIndex: 0, playIndex: 0, yardage: 5 }),
      makeEvent({
        driveIndex: 0,
        playIndex: 1,
        outcome: "interception",
        yardage: 0,
        tags: ["turnover", "interception"],
      }),
    ];
    const log = deriveDriveLog(events);
    assertEquals(log[0].result, "turnover");
  });

  await t.step("identifies safety drives", () => {
    const events: PlayEvent[] = [
      makeEvent({
        driveIndex: 0,
        playIndex: 0,
        yardage: -5,
        tags: ["safety"],
      }),
    ];
    const log = deriveDriveLog(events);
    assertEquals(log[0].result, "safety");
  });

  await t.step(
    "defaults to end_of_half for drives without terminal play",
    () => {
      const events: PlayEvent[] = [
        makeEvent({ driveIndex: 0, playIndex: 0, yardage: 5 }),
        makeEvent({ driveIndex: 0, playIndex: 1, yardage: 3 }),
      ];
      const log = deriveDriveLog(events);
      assertEquals(log[0].result, "end_of_half");
    },
  );

  await t.step("tracks offense team per drive", () => {
    const events: PlayEvent[] = [
      makeEvent({ driveIndex: 0, offenseTeamId: "team-home" }),
      makeEvent({
        driveIndex: 1,
        offenseTeamId: "team-away",
        defenseTeamId: "team-home",
        outcome: "punt",
        yardage: 40,
      }),
    ];
    const log = deriveDriveLog(events);
    assertEquals(log[0].offenseTeamId, "team-home");
    assertEquals(log[1].offenseTeamId, "team-away");
  });

  await t.step("returns empty array for no events", () => {
    assertEquals(deriveDriveLog([]).length, 0);
  });
});

Deno.test("deriveInjuryReport", async (t) => {
  await t.step("extracts injuries with severity from event tags", () => {
    const events: PlayEvent[] = [
      makeEvent({
        driveIndex: 0,
        playIndex: 3,
        quarter: 1,
        tags: ["injury", "injury_miss_drive"],
        participants: [
          {
            role: "ballcarrier",
            playerId: "p1",
            tags: ["injury", "miss_drive"],
          },
          { role: "tackler", playerId: "p2", tags: [] },
        ],
      }),
    ];
    const report = deriveInjuryReport(events);
    assertEquals(report.length, 1);
    assertEquals(report[0].playerId, "p1");
    assertEquals(report[0].severity, "miss_drive");
    assertEquals(report[0].playIndex, 3);
    assertEquals(report[0].driveIndex, 0);
    assertEquals(report[0].quarter, 1);
  });

  await t.step("handles multiple injuries across events", () => {
    const events: PlayEvent[] = [
      makeEvent({
        driveIndex: 0,
        playIndex: 1,
        quarter: 1,
        tags: ["injury", "injury_shake_off"],
        participants: [
          { role: "receiver", playerId: "p1", tags: ["injury", "shake_off"] },
        ],
      }),
      makeEvent({
        driveIndex: 2,
        playIndex: 5,
        quarter: 3,
        tags: ["injury", "injury_miss_game"],
        participants: [
          { role: "blocker", playerId: "p2", tags: ["injury", "miss_game"] },
        ],
      }),
    ];
    const report = deriveInjuryReport(events);
    assertEquals(report.length, 2);
    assertEquals(report[0].playerId, "p1");
    assertEquals(report[0].severity, "shake_off");
    assertEquals(report[1].playerId, "p2");
    assertEquals(report[1].severity, "miss_game");
  });

  await t.step("skips events without injury tag", () => {
    const events: PlayEvent[] = [
      makeEvent({ tags: [] }),
      makeEvent({ tags: ["first_down"] }),
      makeEvent({ tags: ["turnover"] }),
    ];
    assertEquals(deriveInjuryReport(events).length, 0);
  });

  await t.step("returns empty array for no events", () => {
    assertEquals(deriveInjuryReport([]).length, 0);
  });

  await t.step("extracts all severity levels", () => {
    const severities = [
      "shake_off",
      "miss_drive",
      "miss_quarter",
      "miss_game",
      "miss_weeks",
      "miss_season",
      "career_ending",
    ] as const;

    for (const severity of severities) {
      const events: PlayEvent[] = [
        makeEvent({
          tags: ["injury", `injury_${severity}`],
          participants: [
            {
              role: "blocker",
              playerId: `p-${severity}`,
              tags: ["injury", severity],
            },
          ],
        }),
      ];
      const report = deriveInjuryReport(events);
      assertEquals(report.length, 1);
      assertEquals(report[0].severity, severity);
    }
  });

  await t.step("is a pure function — same input yields same output", () => {
    const events: PlayEvent[] = [
      makeEvent({
        tags: ["injury", "injury_miss_game"],
        participants: [
          { role: "runner", playerId: "p1", tags: ["injury", "miss_game"] },
        ],
      }),
    ];
    const a = deriveInjuryReport(events);
    const b = deriveInjuryReport(events);
    assertEquals(a, b);
  });
});

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

function makePlayer(
  id: string,
  bucket: PlayerRuntime["neutralBucket"],
): PlayerRuntime {
  return { playerId: id, neutralBucket: bucket, attributes: makeAttributes() };
}

function makeStarters(prefix: string): PlayerRuntime[] {
  return [
    makePlayer(`${prefix}-qb`, "QB"),
    makePlayer(`${prefix}-rb`, "RB"),
    makePlayer(`${prefix}-wr1`, "WR"),
    makePlayer(`${prefix}-wr2`, "WR"),
    makePlayer(`${prefix}-te`, "TE"),
    makePlayer(`${prefix}-ot1`, "OT"),
    makePlayer(`${prefix}-ot2`, "OT"),
    makePlayer(`${prefix}-iol1`, "IOL"),
    makePlayer(`${prefix}-iol2`, "IOL"),
    makePlayer(`${prefix}-iol3`, "IOL"),
    makePlayer(`${prefix}-edge1`, "EDGE"),
    makePlayer(`${prefix}-edge2`, "EDGE"),
    makePlayer(`${prefix}-idl1`, "IDL"),
    makePlayer(`${prefix}-idl2`, "IDL"),
    makePlayer(`${prefix}-lb1`, "LB"),
    makePlayer(`${prefix}-lb2`, "LB"),
    makePlayer(`${prefix}-cb1`, "CB"),
    makePlayer(`${prefix}-cb2`, "CB"),
    makePlayer(`${prefix}-s1`, "S"),
    makePlayer(`${prefix}-s2`, "S"),
    makePlayer(`${prefix}-k`, "K"),
    makePlayer(`${prefix}-p`, "K"),
  ];
}

function makeBench(prefix: string): PlayerRuntime[] {
  return [
    makePlayer(`${prefix}-qb2`, "QB"),
    makePlayer(`${prefix}-rb2`, "RB"),
    makePlayer(`${prefix}-wr3`, "WR"),
    makePlayer(`${prefix}-wr4`, "WR"),
    makePlayer(`${prefix}-te2`, "TE"),
    makePlayer(`${prefix}-ot3`, "OT"),
    makePlayer(`${prefix}-iol4`, "IOL"),
    makePlayer(`${prefix}-edge3`, "EDGE"),
    makePlayer(`${prefix}-idl3`, "IDL"),
    makePlayer(`${prefix}-lb3`, "LB"),
    makePlayer(`${prefix}-cb3`, "CB"),
    makePlayer(`${prefix}-s3`, "S"),
  ];
}

function makeTeam(prefix: string): SimTeam {
  return {
    teamId: `team-${prefix}`,
    starters: makeStarters(prefix),
    bench: makeBench(prefix),
    fingerprint: makeFingerprint(),
    coachingMods: {
      schemeFitBonus: 2,
      situationalBonus: 1,
      aggressiveness: 50,
    } as CoachingMods,
  };
}

Deno.test("round-trip: derivations match simulateGame output", async (t) => {
  await t.step(
    "deriveBoxScore over events matches simulateGame boxScore",
    () => {
      const result = simulateGame({
        home: makeTeam("home"),
        away: makeTeam("away"),
        seed: 42,
      });

      const derived = deriveBoxScore(
        result.events,
        "team-home",
        "team-away",
      );
      assertEquals(derived, result.boxScore);
    },
  );

  await t.step(
    "deriveDriveLog over events matches simulateGame driveLog",
    () => {
      const result = simulateGame({
        home: makeTeam("home"),
        away: makeTeam("away"),
        seed: 42,
      });

      const derived = deriveDriveLog(result.events);
      assertEquals(derived, result.driveLog);
    },
  );

  await t.step(
    "deriveInjuryReport over events matches simulateGame injuryReport",
    () => {
      const result = simulateGame({
        home: makeTeam("home"),
        away: makeTeam("away"),
        seed: 42,
      });

      const derived = deriveInjuryReport(result.events);
      assertEquals(derived, result.injuryReport);
    },
  );

  await t.step("derivations are deterministic across seeds", () => {
    for (let seed = 1; seed <= 5; seed++) {
      const result = simulateGame({
        home: makeTeam("home"),
        away: makeTeam("away"),
        seed,
      });

      assertEquals(
        deriveBoxScore(result.events, "team-home", "team-away"),
        result.boxScore,
      );
      assertEquals(deriveDriveLog(result.events), result.driveLog);
      assertEquals(deriveInjuryReport(result.events), result.injuryReport);
    }
  });

  await t.step("derivations produce non-empty results for a full game", () => {
    const result = simulateGame({
      home: makeTeam("home"),
      away: makeTeam("away"),
      seed: 42,
    });

    assertGreater(result.driveLog.length, 0);
    assertGreater(
      result.boxScore.home.totalYards + result.boxScore.away.totalYards,
      0,
    );
  });
});
