import { assertEquals } from "@std/assert";
import {
  assignDepthChart,
  type DepthChartAssignment,
  type PlayerForAssignment,
} from "./assign.ts";
import type { DepthChartSlotDefinition } from "./vocabulary.ts";

function slot(
  code: string,
  group: "offense" | "defense" | "special_teams" = "offense",
): DepthChartSlotDefinition {
  return { code, label: code, group };
}

function player(
  id: string,
  neutralBucket: PlayerForAssignment["neutralBucket"],
  score: number,
): PlayerForAssignment {
  return { id, neutralBucket, score };
}

function findByPlayer(
  assignments: DepthChartAssignment[],
  playerId: string,
): DepthChartAssignment | undefined {
  return assignments.find((a) => a.playerId === playerId);
}

function forSlot(
  assignments: DepthChartAssignment[],
  slotCode: string,
): DepthChartAssignment[] {
  return assignments
    .filter((a) => a.slotCode === slotCode)
    .sort((a, b) => a.slotOrdinal - b.slotOrdinal);
}

Deno.test("assignDepthChart: empty player list returns empty assignments", () => {
  const result = assignDepthChart([], [slot("QB")]);
  assertEquals(result, []);
});

Deno.test("assignDepthChart: assigns single player to matching slot", () => {
  const result = assignDepthChart(
    [player("qb1", "QB", 80)],
    [slot("QB")],
  );
  assertEquals(result.length, 1);
  assertEquals(result[0].playerId, "qb1");
  assertEquals(result[0].slotCode, "QB");
  assertEquals(result[0].slotOrdinal, 1);
  assertEquals(result[0].isInactive, false);
});

Deno.test("assignDepthChart: ranks players by score within a slot", () => {
  const result = assignDepthChart(
    [player("qb1", "QB", 60), player("qb2", "QB", 90)],
    [slot("QB")],
  );
  const qbSlot = forSlot(result, "QB");
  assertEquals(qbSlot.length, 2);
  assertEquals(qbSlot[0].playerId, "qb2");
  assertEquals(qbSlot[0].slotOrdinal, 1);
  assertEquals(qbSlot[1].playerId, "qb1");
  assertEquals(qbSlot[1].slotOrdinal, 2);
});

Deno.test("assignDepthChart: distributes OT across LT and RT", () => {
  const result = assignDepthChart(
    [
      player("ot1", "OT", 90),
      player("ot2", "OT", 80),
      player("ot3", "OT", 70),
      player("ot4", "OT", 60),
    ],
    [slot("LT"), slot("RT")],
  );
  const lt = forSlot(result, "LT");
  const rt = forSlot(result, "RT");
  assertEquals(lt.length, 2);
  assertEquals(rt.length, 2);
  assertEquals(lt[0].playerId, "ot1");
  assertEquals(rt[0].playerId, "ot2");
  assertEquals(lt[1].playerId, "ot3");
  assertEquals(rt[1].playerId, "ot4");
});

Deno.test("assignDepthChart: distributes IOL across LG, C, RG", () => {
  const result = assignDepthChart(
    [
      player("iol1", "IOL", 90),
      player("iol2", "IOL", 80),
      player("iol3", "IOL", 70),
    ],
    [slot("LG"), slot("C"), slot("RG")],
  );
  assertEquals(forSlot(result, "LG").length, 1);
  assertEquals(forSlot(result, "C").length, 1);
  assertEquals(forSlot(result, "RG").length, 1);
  assertEquals(forSlot(result, "LG")[0].playerId, "iol1");
  assertEquals(forSlot(result, "C")[0].playerId, "iol2");
  assertEquals(forSlot(result, "RG")[0].playerId, "iol3");
});

Deno.test("assignDepthChart: each player appears exactly once", () => {
  const players = [
    player("qb1", "QB", 90),
    player("qb2", "QB", 80),
    player("rb1", "RB", 85),
    player("wr1", "WR", 75),
  ];
  const vocab = [slot("QB"), slot("RB"), slot("WR")];
  const result = assignDepthChart(players, vocab);
  assertEquals(result.length, 4);
  const playerIds = result.map((a) => a.playerId).sort();
  assertEquals(playerIds, ["qb1", "qb2", "rb1", "wr1"]);
});

Deno.test("assignDepthChart: no duplicate (slotCode, slotOrdinal) pairs", () => {
  const players = [
    player("qb1", "QB", 90),
    player("qb2", "QB", 80),
    player("qb3", "QB", 70),
    player("rb1", "RB", 85),
    player("rb2", "RB", 75),
  ];
  const vocab = [slot("QB"), slot("RB")];
  const result = assignDepthChart(players, vocab);
  const keys = result.map((a) => `${a.slotCode}:${a.slotOrdinal}`);
  assertEquals(new Set(keys).size, keys.length);
});

Deno.test("assignDepthChart: players with no matching slot become inactive", () => {
  const result = assignDepthChart(
    [player("k1", "K", 80)],
    [slot("QB")],
  );
  assertEquals(result.length, 1);
  assertEquals(result[0].isInactive, true);
});

Deno.test("assignDepthChart: CB bucket fills both CB and NCB slots", () => {
  const result = assignDepthChart(
    [
      player("cb1", "CB", 90),
      player("cb2", "CB", 85),
      player("cb3", "CB", 80),
    ],
    [slot("CB", "defense"), slot("NCB", "defense")],
  );
  const cb = forSlot(result, "CB");
  const ncb = forSlot(result, "NCB");
  assertEquals(cb[0].playerId, "cb1");
  assertEquals(ncb[0].playerId, "cb2");
});

Deno.test("assignDepthChart: mixed roster assigns all positions", () => {
  const players = [
    player("qb1", "QB", 80),
    player("rb1", "RB", 75),
    player("wr1", "WR", 70),
    player("te1", "TE", 65),
    player("ot1", "OT", 85),
    player("iol1", "IOL", 72),
    player("edge1", "EDGE", 78),
    player("idl1", "IDL", 68),
    player("lb1", "LB", 73),
    player("cb1", "CB", 82),
    player("s1", "S", 76),
    player("k1", "K", 50),
    player("p1", "P", 50),
    player("ls1", "LS", 50),
  ];
  const vocab = [
    slot("QB"),
    slot("RB"),
    slot("WR"),
    slot("TE"),
    slot("LT"),
    slot("LG"),
    slot("C"),
    slot("RG"),
    slot("RT"),
    slot("DE", "defense"),
    slot("DT", "defense"),
    slot("LB", "defense"),
    slot("CB", "defense"),
    slot("S", "defense"),
    slot("K", "special_teams"),
    slot("P", "special_teams"),
    slot("LS", "special_teams"),
  ];
  const result = assignDepthChart(players, vocab);
  assertEquals(result.length, 14);
  for (const a of result) {
    assertEquals(a.isInactive, false);
  }
  assertEquals(findByPlayer(result, "qb1")!.slotCode, "QB");
  assertEquals(findByPlayer(result, "ot1")!.slotCode, "LT");
  assertEquals(findByPlayer(result, "iol1")!.slotCode, "LG");
  assertEquals(findByPlayer(result, "edge1")!.slotCode, "DE");
  assertEquals(findByPlayer(result, "idl1")!.slotCode, "DT");
});

Deno.test("assignDepthChart: FB slot prefers RB-bucket players first", () => {
  const result = assignDepthChart(
    [
      player("rb1", "RB", 90),
      player("rb2", "RB", 60),
    ],
    [slot("RB"), slot("FB")],
  );
  assertEquals(findByPlayer(result, "rb1")!.slotCode, "RB");
  assertEquals(findByPlayer(result, "rb2")!.slotCode, "FB");
});
