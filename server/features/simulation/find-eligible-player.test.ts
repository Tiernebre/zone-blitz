import { assertEquals } from "@std/assert";
import { PLAYER_ATTRIBUTE_KEYS } from "@zone-blitz/shared";
import type { PlayerAttributes } from "@zone-blitz/shared";
import type { PlayerRuntime } from "./resolve-play.ts";
import {
  COVERAGE_UNIT_POSITIONS,
  findEligiblePlayer,
  findEligiblePlayers,
  KICKER_POSITIONS,
  RETURNER_POSITIONS,
} from "./find-eligible-player.ts";

function makeAttributes(): PlayerAttributes {
  const base: Partial<PlayerAttributes> = {};
  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    (base as Record<string, number>)[key] = 50;
    (base as Record<string, number>)[`${key}Potential`] = 50;
  }
  return base as PlayerAttributes;
}

function makePlayer(
  id: string,
  bucket: PlayerRuntime["neutralBucket"],
): PlayerRuntime {
  return {
    playerId: id,
    neutralBucket: bucket,
    attributes: makeAttributes(),
  };
}

Deno.test("findEligiblePlayer returns first player matching a single position", () => {
  const roster = [
    makePlayer("qb1", "QB"),
    makePlayer("k1", "K"),
    makePlayer("wr1", "WR"),
  ];
  const result = findEligiblePlayer(roster, {
    positions: ["K"],
    injuredIds: new Set(),
  });
  assertEquals(result?.playerId, "k1");
});

Deno.test("findEligiblePlayer skips injured players", () => {
  const roster = [
    makePlayer("k1", "K"),
    makePlayer("k2", "K"),
  ];
  const result = findEligiblePlayer(roster, {
    positions: ["K"],
    injuredIds: new Set(["k1"]),
  });
  assertEquals(result?.playerId, "k2");
});

Deno.test("findEligiblePlayer returns undefined when no match and no fallback", () => {
  const roster = [makePlayer("qb1", "QB")];
  const result = findEligiblePlayer(roster, {
    positions: ["K"],
    injuredIds: new Set(),
  });
  assertEquals(result, undefined);
});

Deno.test("findEligiblePlayer returns fallback when no eligible match", () => {
  const fallback = makePlayer("k-fallback", "K");
  const roster = [makePlayer("qb1", "QB")];
  const result = findEligiblePlayer(roster, {
    positions: ["K"],
    injuredIds: new Set(),
    fallback,
  });
  assertEquals(result?.playerId, "k-fallback");
});

Deno.test("findEligiblePlayer prioritizes positions in order", () => {
  const roster = [
    makePlayer("rb1", "RB"),
    makePlayer("wr1", "WR"),
  ];
  const result = findEligiblePlayer(roster, {
    positions: ["WR", "RB"],
    injuredIds: new Set(),
  });
  assertEquals(result?.playerId, "wr1");
});

Deno.test("findEligiblePlayer falls through to second position when first has no match", () => {
  const roster = [
    makePlayer("rb1", "RB"),
    makePlayer("qb1", "QB"),
  ];
  const result = findEligiblePlayer(roster, {
    positions: ["WR", "RB"],
    injuredIds: new Set(),
  });
  assertEquals(result?.playerId, "rb1");
});

Deno.test("findEligiblePlayer returns fallback when all matching players are injured", () => {
  const fallback = makePlayer("k-fallback", "K");
  const roster = [makePlayer("k1", "K")];
  const result = findEligiblePlayer(roster, {
    positions: ["K"],
    injuredIds: new Set(["k1"]),
    fallback,
  });
  assertEquals(result?.playerId, "k-fallback");
});

Deno.test("findEligiblePlayers returns all matching players", () => {
  const roster = [
    makePlayer("lb1", "LB"),
    makePlayer("s1", "S"),
    makePlayer("cb1", "CB"),
    makePlayer("qb1", "QB"),
    makePlayer("lb2", "LB"),
    makePlayer("cb2", "CB"),
  ];
  const result = findEligiblePlayers(roster, {
    positions: ["LB", "S", "CB"],
    injuredIds: new Set(),
  });
  assertEquals(result.length, 5);
});

Deno.test("findEligiblePlayers respects limit", () => {
  const roster = [
    makePlayer("lb1", "LB"),
    makePlayer("s1", "S"),
    makePlayer("cb1", "CB"),
    makePlayer("lb2", "LB"),
    makePlayer("cb2", "CB"),
  ];
  const result = findEligiblePlayers(roster, {
    positions: ["LB", "S", "CB"],
    injuredIds: new Set(),
    limit: 4,
  });
  assertEquals(result.length, 4);
});

Deno.test("findEligiblePlayers skips injured players", () => {
  const roster = [
    makePlayer("lb1", "LB"),
    makePlayer("s1", "S"),
    makePlayer("cb1", "CB"),
  ];
  const result = findEligiblePlayers(roster, {
    positions: ["LB", "S", "CB"],
    injuredIds: new Set(["s1"]),
  });
  assertEquals(result.length, 2);
  assertEquals(
    result.map((p: PlayerRuntime) => p.playerId),
    ["lb1", "cb1"],
  );
});

Deno.test("findEligiblePlayers returns empty array when no matches", () => {
  const roster = [makePlayer("qb1", "QB")];
  const result = findEligiblePlayers(roster, {
    positions: ["LB", "S", "CB"],
    injuredIds: new Set(),
  });
  assertEquals(result.length, 0);
});

Deno.test("KICKER_POSITIONS contains K", () => {
  assertEquals(KICKER_POSITIONS, ["K"]);
});

Deno.test("RETURNER_POSITIONS contains WR and RB in priority order", () => {
  assertEquals(RETURNER_POSITIONS, ["WR", "RB"]);
});

Deno.test("COVERAGE_UNIT_POSITIONS contains LB, S, and CB", () => {
  assertEquals(COVERAGE_UNIT_POSITIONS, ["LB", "S", "CB"]);
});
