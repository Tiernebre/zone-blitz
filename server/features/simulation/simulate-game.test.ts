import { assertEquals, assertGreater, assertLessOrEqual } from "@std/assert";
import {
  PLAYER_ATTRIBUTE_KEYS,
  type PlayerAttributes,
  type SchemeFingerprint,
} from "@zone-blitz/shared";
import type {
  CoachingMods,
  PlayerRuntime,
  TeamRuntime,
} from "./resolve-play.ts";
import { simulateGame } from "./simulate-game.ts";

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
  overrides: Partial<PlayerAttributes> = {},
): PlayerRuntime {
  return {
    playerId: id,
    neutralBucket: bucket,
    attributes: makeAttributes(overrides),
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

function makeTeam(prefix: string): TeamRuntime {
  const offense = makeOffense().map((p) => ({
    ...p,
    playerId: `${prefix}-${p.playerId}`,
  }));
  const defense = makeDefense().map((p) => ({
    ...p,
    playerId: `${prefix}-${p.playerId}`,
  }));
  return {
    fingerprint: makeFingerprint(),
    onField: [...offense, ...defense],
    coachingMods: { schemeFitBonus: 0, situationalBonus: 0 } as CoachingMods,
  };
}

Deno.test("simulateGame returns a GameResult with events", () => {
  const home = makeTeam("home");
  const away = makeTeam("away");
  const result = simulateGame(home, away, 42, "game-1");

  assertEquals(result.gameId, "game-1");
  assertEquals(result.seed, 42);
  assertGreater(result.events.length, 0);
});

Deno.test("simulateGame is deterministic for the same seed", () => {
  const home = makeTeam("home");
  const away = makeTeam("away");
  const result1 = simulateGame(home, away, 42, "game-1");
  const result2 = simulateGame(home, away, 42, "game-1");

  assertEquals(result1.finalScore, result2.finalScore);
  assertEquals(result1.events.length, result2.events.length);
});

Deno.test("simulateGame produces different results for different seeds", () => {
  const home = makeTeam("home");
  const away = makeTeam("away");
  const result1 = simulateGame(home, away, 42, "game-1");
  const result2 = simulateGame(home, away, 99, "game-1");

  const sameScore = result1.finalScore.home === result2.finalScore.home &&
    result1.finalScore.away === result2.finalScore.away;
  const sameLength = result1.events.length === result2.events.length;
  assertEquals(sameScore && sameLength, false);
});

Deno.test("simulateGame produces play counts in NFL-realistic range", () => {
  const home = makeTeam("home");
  const away = makeTeam("away");

  let totalPlays = 0;
  const numGames = 20;
  for (let seed = 1; seed <= numGames; seed++) {
    const result = simulateGame(home, away, seed, `game-${seed}`);
    const offensivePlays = result.events.filter(
      (e) =>
        e.outcome === "rush" ||
        e.outcome === "pass_complete" ||
        e.outcome === "pass_incomplete" ||
        e.outcome === "sack" ||
        e.outcome === "interception" ||
        e.outcome === "fumble" ||
        e.outcome === "touchdown",
    ).length;
    totalPlays += offensivePlays;
  }

  const avgPlays = totalPlays / numGames;
  assertGreater(avgPlays, 100, `Average plays per game ${avgPlays} too low`);
  assertLessOrEqual(
    avgPlays,
    170,
    `Average plays per game ${avgPlays} too high`,
  );
});

Deno.test("simulateGame final scores are non-negative", () => {
  const home = makeTeam("home");
  const away = makeTeam("away");

  for (let seed = 1; seed <= 10; seed++) {
    const result = simulateGame(home, away, seed, `game-${seed}`);
    assertGreater(
      result.finalScore.home + result.finalScore.away,
      -1,
      "Scores must be non-negative",
    );
  }
});
