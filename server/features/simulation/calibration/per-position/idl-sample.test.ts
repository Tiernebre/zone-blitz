import { assertAlmostEquals, assertEquals } from "@std/assert";
import type { PlayerAttributes } from "@zone-blitz/shared";
import { collectIdlSamples } from "./idl-sample.ts";
import type { GameResult, PlayEvent } from "../../events.ts";
import type { SimTeam } from "../../simulate-game.ts";
import type { PlayerRuntime } from "../../resolve-play.ts";

function attrs(overrides: Partial<PlayerAttributes> = {}): PlayerAttributes {
  const base: Record<string, number> = {};
  const keys = [
    "speed",
    "acceleration",
    "agility",
    "strength",
    "jumping",
    "stamina",
    "durability",
    "armStrength",
    "accuracyShort",
    "accuracyMedium",
    "accuracyDeep",
    "accuracyOnTheRun",
    "touch",
    "release",
    "ballCarrying",
    "elusiveness",
    "routeRunning",
    "catching",
    "contestedCatching",
    "runAfterCatch",
    "passBlocking",
    "runBlocking",
    "blockShedding",
    "tackling",
    "manCoverage",
    "zoneCoverage",
    "passRushing",
    "runDefense",
    "kickingPower",
    "kickingAccuracy",
    "puntingPower",
    "puntingAccuracy",
    "snapAccuracy",
    "footballIq",
    "decisionMaking",
    "anticipation",
    "composure",
    "clutch",
    "consistency",
    "workEthic",
    "coachability",
    "leadership",
    "greed",
    "loyalty",
    "ambition",
    "vanity",
    "schemeAttachment",
    "mediaSensitivity",
  ];
  for (const k of keys) {
    base[k] = 50;
    base[`${k}Potential`] = 50;
  }
  return { ...(base as unknown as PlayerAttributes), ...overrides };
}

function idl(id: string, overall: number): PlayerRuntime {
  return {
    playerId: id,
    neutralBucket: "IDL",
    attributes: attrs({
      passRushing: overall,
      strength: overall,
      blockShedding: overall,
      runDefense: overall,
      tackling: overall,
    }),
  };
}

function edge(id: string, overall: number): PlayerRuntime {
  return {
    playerId: id,
    neutralBucket: "EDGE",
    attributes: attrs({
      passRushing: overall,
      acceleration: overall,
      blockShedding: overall,
      speed: overall,
    }),
  };
}

function team(teamId: string, starters: PlayerRuntime[]): SimTeam {
  return {
    teamId,
    starters,
    bench: [],
    fingerprint: { offense: null, defense: null, overrides: {} },
    coachingMods: {
      schemeFitBonus: 0,
      situationalBonus: 0,
      aggressiveness: 50,
      penaltyDiscipline: 1,
    },
  };
}

function event(
  overrides: Partial<PlayEvent> & {
    outcome: PlayEvent["outcome"];
    offenseTeamId: string;
    defenseTeamId: string;
  },
): PlayEvent {
  return {
    gameId: "g",
    driveIndex: 0,
    playIndex: 0,
    quarter: 1,
    clock: "15:00",
    situation: { down: 1, distance: 10, yardLine: 25 },
    call: {
      concept: "dropback",
      personnel: "11",
      formation: "shotgun",
      motion: "none",
    },
    coverage: { front: "4-3", coverage: "cover_2", pressure: "four_man" },
    participants: [],
    yardage: 0,
    tags: [],
    ...overrides,
  };
}

function gameOf(events: PlayEvent[]): GameResult {
  return {
    gameId: "g",
    seed: 1,
    finalScore: { home: 0, away: 0 },
    events,
    boxScore: {
      home: {
        totalYards: 0,
        passingYards: 0,
        rushingYards: 0,
        turnovers: 0,
        sacks: 0,
        penalties: 0,
      },
      away: {
        totalYards: 0,
        passingYards: 0,
        rushingYards: 0,
        turnovers: 0,
        sacks: 0,
        penalties: 0,
      },
    },
    driveLog: [],
    injuryReport: [],
  };
}

Deno.test("collectIdlSamples returns one sample per starter IDL per team", () => {
  const home = team("home", [idl("home-idl1", 50), idl("home-idl2", 50)]);
  const away = team("away", [idl("away-idl1", 50), idl("away-idl2", 50)]);
  const samples = collectIdlSamples({
    game: gameOf([]),
    home,
    away,
  });
  assertEquals(samples.length, 4);
  assertEquals(samples.map((s) => s.idlPlayerId).sort(), [
    "away-idl1",
    "away-idl2",
    "home-idl1",
    "home-idl2",
  ]);
});

Deno.test("collectIdlSamples skips teams without starter IDLs", () => {
  const home = team("home", [idl("home-idl1", 50)]);
  const away = team("away", [edge("away-edge", 60)]);
  const samples = collectIdlSamples({
    game: gameOf([]),
    home,
    away,
  });
  assertEquals(samples.length, 1);
  assertEquals(samples[0].teamId, "home");
});

Deno.test("collectIdlSamples tags sample with IDL overall (mean of five signature attrs)", () => {
  const home = team("home", [{
    playerId: "home-idl",
    neutralBucket: "IDL",
    attributes: attrs({
      passRushing: 60,
      strength: 80,
      blockShedding: 70,
      runDefense: 50,
      tackling: 65,
    }),
  }]);
  const away = team("away", [idl("away-idl", 50)]);
  const [homeSample] = collectIdlSamples({
    game: gameOf([]),
    home,
    away,
  });
  // (60 + 80 + 70 + 50 + 65) / 5 = 65
  assertAlmostEquals(homeSample.idlOverall, 65, 0.01);
});

Deno.test("collectIdlSamples credits sacks to the tagged IDL defender", () => {
  const home = team("home", [idl("home-idl1", 50), idl("home-idl2", 50)]);
  const away = team("away", [idl("away-idl1", 50)]);
  const events: PlayEvent[] = [
    event({
      outcome: "sack",
      offenseTeamId: "away",
      defenseTeamId: "home",
      yardage: -7,
      participants: [
        { role: "pass_rush", playerId: "home-idl1", tags: ["sack"] },
      ],
    }),
    event({
      outcome: "sack",
      offenseTeamId: "away",
      defenseTeamId: "home",
      yardage: -5,
      participants: [
        { role: "pass_rush", playerId: "home-idl2", tags: ["sack"] },
      ],
    }),
  ];
  const samples = collectIdlSamples({
    game: gameOf(events),
    home,
    away,
  });
  const home1 = samples.find((s) => s.idlPlayerId === "home-idl1")!;
  const home2 = samples.find((s) => s.idlPlayerId === "home-idl2")!;
  assertEquals(home1.sacks, 1);
  assertEquals(home2.sacks, 1);
});

Deno.test(
  "collectIdlSamples ignores sacks credited to non-IDL defenders",
  () => {
    const home = team("home", [idl("home-idl1", 50)]);
    const away = team("away", [
      idl("away-idl1", 50),
      edge("away-edge", 70),
    ]);
    const events: PlayEvent[] = [
      event({
        outcome: "sack",
        offenseTeamId: "home",
        defenseTeamId: "away",
        yardage: -7,
        participants: [
          { role: "pass_rush", playerId: "away-edge", tags: ["sack"] },
        ],
      }),
    ];
    const samples = collectIdlSamples({
      game: gameOf(events),
      home,
      away,
    });
    const away1 = samples.find((s) => s.idlPlayerId === "away-idl1")!;
    assertEquals(away1.sacks, 0);
  },
);

Deno.test(
  "collectIdlSamples team-allocates run-stop proxies evenly across starter IDLs",
  () => {
    // The engine doesn't log per-defender tackle/TFL/QB-hit events, so
    // the sample builder falls back to a team-level proxy split evenly
    // across the IDL starters on the field. A team that forces two
    // stuffs on rush plays and two sacks should see each of its two
    // IDLs credited with half of the run-stop proxies.
    const home = team("home", [idl("home-idl1", 50), idl("home-idl2", 50)]);
    const away = team("away", [idl("away-idl1", 50), idl("away-idl2", 50)]);
    const events: PlayEvent[] = [
      // Two rush plays where the offense was stuffed (yardage < 1) —
      // credit as TFLs + tackles against the defensive team.
      event({
        outcome: "rush",
        offenseTeamId: "away",
        defenseTeamId: "home",
        yardage: -2,
        call: {
          concept: "inside_zone",
          personnel: "11",
          formation: "singleback",
          motion: "none",
        },
      }),
      event({
        outcome: "rush",
        offenseTeamId: "away",
        defenseTeamId: "home",
        yardage: 0,
        call: {
          concept: "power",
          personnel: "11",
          formation: "singleback",
          motion: "none",
        },
      }),
      // A regular 4-yard gain should count as a tackle but not a TFL.
      event({
        outcome: "rush",
        offenseTeamId: "away",
        defenseTeamId: "home",
        yardage: 4,
        call: {
          concept: "outside_zone",
          personnel: "11",
          formation: "singleback",
          motion: "none",
        },
      }),
      // Pass with pressure -> qb_hit proxy
      event({
        outcome: "pass_incomplete",
        offenseTeamId: "away",
        defenseTeamId: "home",
        yardage: 0,
        tags: ["pressure"],
      }),
    ];
    const samples = collectIdlSamples({
      game: gameOf(events),
      home,
      away,
    });
    const home1 = samples.find((s) => s.idlPlayerId === "home-idl1")!;
    const home2 = samples.find((s) => s.idlPlayerId === "home-idl2")!;

    // Two stuffs plus one regular tackle => 3 team tackles, split 50/50
    // across the two IDL starters => 1.5 tackles each.
    assertAlmostEquals(home1.tackles, 1.5);
    assertAlmostEquals(home2.tackles, 1.5);

    // Two stuffs => 2 team TFLs => 1 TFL each.
    assertAlmostEquals(home1.tfl, 1);
    assertAlmostEquals(home2.tfl, 1);

    // One pressure (non-sack) => 1 team QB hit => 0.5 each.
    assertAlmostEquals(home1.qb_hits, 0.5);
    assertAlmostEquals(home2.qb_hits, 0.5);
  },
);

Deno.test("collectIdlSamples emits per-game rates", () => {
  const home = team("home", [idl("home-idl1", 50), idl("home-idl2", 50)]);
  const away = team("away", [idl("away-idl", 50)]);
  const events: PlayEvent[] = [
    event({
      outcome: "sack",
      offenseTeamId: "away",
      defenseTeamId: "home",
      yardage: -6,
      participants: [
        { role: "pass_rush", playerId: "home-idl1", tags: ["sack"] },
      ],
    }),
    event({
      outcome: "rush",
      offenseTeamId: "away",
      defenseTeamId: "home",
      yardage: -1,
      call: {
        concept: "inside_zone",
        personnel: "11",
        formation: "singleback",
        motion: "none",
      },
    }),
  ];
  const samples = collectIdlSamples({
    game: gameOf(events),
    home,
    away,
  });
  const home1 = samples.find((s) => s.idlPlayerId === "home-idl1")!;
  // One sample spans one game, so per-game rates equal raw counts.
  assertEquals(home1.sacks_per_game, home1.sacks);
  assertEquals(home1.tackles_per_game, home1.tackles);
  assertEquals(home1.tfl_per_game, home1.tfl);
  assertEquals(home1.qb_hits_per_game, home1.qb_hits);
});
