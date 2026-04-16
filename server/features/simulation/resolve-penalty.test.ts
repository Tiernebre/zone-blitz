import { assertEquals, assertExists } from "@std/assert";
import {
  decidePenaltyAcceptance,
  PENALTY_CATALOG,
  type PenaltyCandidate,
  type PenaltyContext,
  pickPenalty,
  shouldPenaltyOccur,
} from "./resolve-penalty.ts";
import type { PenaltyInfo, PenaltyType } from "./events.ts";
import { createSeededRng } from "./rng.ts";

function makePenaltyContext(
  overrides: Partial<PenaltyContext> = {},
): PenaltyContext {
  return {
    offenseTeamId: "team-a",
    defenseTeamId: "team-b",
    offensePositions: [
      "QB",
      "RB",
      "WR",
      "WR",
      "TE",
      "OT",
      "OT",
      "IOL",
      "IOL",
      "IOL",
    ],
    defensePositions: [
      "EDGE",
      "EDGE",
      "IDL",
      "IDL",
      "LB",
      "LB",
      "CB",
      "CB",
      "S",
      "S",
    ],
    offensePlayerIds: [
      "qb1",
      "rb1",
      "wr1",
      "wr2",
      "te1",
      "ot1",
      "ot2",
      "iol1",
      "iol2",
      "iol3",
    ],
    defensePlayerIds: [
      "edge1",
      "edge2",
      "idl1",
      "idl2",
      "lb1",
      "lb2",
      "cb1",
      "cb2",
      "s1",
      "s2",
    ],
    isRunPlay: false,
    playYardage: 8,
    playGainedFirstDown: true,
    situation: { down: 2, distance: 10, yardLine: 35 },
    ...overrides,
  };
}

Deno.test("PENALTY_CATALOG", async (t) => {
  await t.step("contains all expected penalty types", () => {
    const types: PenaltyType[] = [
      "false_start",
      "offsides",
      "delay_of_game",
      "holding",
      "defensive_holding",
      "pass_interference",
      "defensive_pass_interference",
      "facemask",
      "roughing_the_passer",
      "illegal_block_in_the_back",
      "illegal_use_of_hands",
      "unnecessary_roughness",
      "encroachment",
      "neutral_zone_infraction",
      "illegal_contact",
    ];
    for (const typ of types) {
      const entry = PENALTY_CATALOG.find((p: PenaltyCandidate) =>
        p.type === typ
      );
      assertExists(entry, `Missing penalty type: ${typ}`);
    }
  });

  await t.step(
    "each entry has valid yardage, phase, and automatic first down flag",
    () => {
      for (const entry of PENALTY_CATALOG) {
        assertEquals(
          entry.yardage > 0,
          true,
          `${entry.type} yardage must be > 0`,
        );
        assertEquals(
          entry.phase === "pre_snap" || entry.phase === "post_snap",
          true,
          `${entry.type} has invalid phase`,
        );
        assertEquals(typeof entry.automaticFirstDown, "boolean");
      }
    },
  );

  await t.step("pre-snap penalties are against the offense", () => {
    const preSnap = PENALTY_CATALOG.filter((p: PenaltyCandidate) =>
      p.phase === "pre_snap"
    );
    for (const p of preSnap) {
      assertEquals(p.side, "offense");
    }
  });

  await t.step("post-snap penalties exist for both sides", () => {
    const postSnap = PENALTY_CATALOG.filter((p: PenaltyCandidate) =>
      p.phase === "post_snap"
    );
    const sides = new Set(postSnap.map((p: PenaltyCandidate) => p.side));
    assertEquals(sides.has("offense"), true);
    assertEquals(sides.has("defense"), true);
  });

  await t.step("each entry has at least one position tendency", () => {
    for (const entry of PENALTY_CATALOG) {
      assertEquals(entry.positionTendencies.length > 0, true);
    }
  });
});

Deno.test("shouldPenaltyOccur", async (t) => {
  await t.step("returns true at NFL-realistic rate over many rolls", () => {
    const rng = createSeededRng(42);
    let penalties = 0;
    const trials = 10000;
    for (let i = 0; i < trials; i++) {
      if (shouldPenaltyOccur(rng)) penalties++;
    }
    const rate = penalties / trials;
    assertEquals(rate > 0.005, true, `Rate ${rate} too low`);
    assertEquals(rate < 0.05, true, `Rate ${rate} too high`);
  });
});

Deno.test("pickPenalty", async (t) => {
  await t.step("returns a penalty with valid type and info", () => {
    const rng = createSeededRng(123);
    const ctx = makePenaltyContext();
    const result = pickPenalty(ctx, rng);
    assertExists(result);
    assertExists(result.type);
    assertExists(result.phase);
    assertEquals(result.yardage > 0, true);
    assertEquals(typeof result.automaticFirstDown, "boolean");
    assertEquals(typeof result.accepted, "boolean");
  });

  await t.step("assigns penalty to a player from the appropriate team", () => {
    const ctx = makePenaltyContext();
    let foundOffense = false;
    let foundDefense = false;
    for (let i = 0; i < 200; i++) {
      const result = pickPenalty(ctx, createSeededRng(i));
      if (!result) continue;
      if (result.againstTeamId === ctx.offenseTeamId) {
        if (result.againstPlayerId) {
          assertEquals(
            ctx.offensePlayerIds.includes(result.againstPlayerId),
            true,
          );
        }
        foundOffense = true;
      } else {
        if (result.againstPlayerId) {
          assertEquals(
            ctx.defensePlayerIds.includes(result.againstPlayerId),
            true,
          );
        }
        foundDefense = true;
      }
    }
    assertEquals(
      foundOffense,
      true,
      "Should find at least one offense penalty",
    );
    assertEquals(
      foundDefense,
      true,
      "Should find at least one defense penalty",
    );
  });

  await t.step("OL positions draw holding/false_start penalties", () => {
    const olPenalties = new Set<PenaltyType>();
    for (let seed = 0; seed < 500; seed++) {
      const ctx = makePenaltyContext({
        offensePositions: [
          "OT",
          "OT",
          "IOL",
          "IOL",
          "IOL",
          "QB",
          "RB",
          "WR",
          "WR",
          "TE",
        ],
        offensePlayerIds: [
          "ot1",
          "ot2",
          "iol1",
          "iol2",
          "iol3",
          "qb1",
          "rb1",
          "wr1",
          "wr2",
          "te1",
        ],
      });
      const result = pickPenalty(ctx, createSeededRng(seed));
      if (result && result.againstTeamId === ctx.offenseTeamId) {
        const olIds = ["ot1", "ot2", "iol1", "iol2", "iol3"];
        if (result.againstPlayerId && olIds.includes(result.againstPlayerId)) {
          olPenalties.add(result.type);
        }
      }
    }
    const olPenaltyTypes: PenaltyType[] = ["false_start", "holding"];
    const found = olPenaltyTypes.some((typ) => olPenalties.has(typ));
    assertEquals(found, true, "OL should draw holding or false_start");
  });

  await t.step("DBs draw PI/holding penalties", () => {
    const dbPenalties = new Set<PenaltyType>();
    for (let seed = 0; seed < 500; seed++) {
      const ctx = makePenaltyContext();
      const result = pickPenalty(ctx, createSeededRng(seed));
      if (result && result.againstTeamId === ctx.defenseTeamId) {
        const dbIds = ["cb1", "cb2", "s1", "s2"];
        if (result.againstPlayerId && dbIds.includes(result.againstPlayerId)) {
          dbPenalties.add(result.type);
        }
      }
    }
    const dbPenaltyTypes: PenaltyType[] = [
      "defensive_pass_interference",
      "defensive_holding",
      "illegal_contact",
    ];
    const found = dbPenaltyTypes.some((typ) => dbPenalties.has(typ));
    assertEquals(found, true, "DBs should draw DPI/holding/illegal_contact");
  });

  await t.step("pre-snap penalties are always against the offense", () => {
    for (let seed = 0; seed < 300; seed++) {
      const ctx = makePenaltyContext();
      const result = pickPenalty(ctx, createSeededRng(seed));
      if (result && result.phase === "pre_snap") {
        assertEquals(result.againstTeamId, ctx.offenseTeamId);
      }
    }
  });
});

Deno.test("decidePenaltyAcceptance", async (t) => {
  await t.step("accepts defensive penalty when play lost yardage", () => {
    const penalty: PenaltyInfo = {
      type: "defensive_holding",
      phase: "post_snap",
      yardage: 5,
      automaticFirstDown: true,
      againstTeamId: "team-b",
      againstPlayerId: "cb1",
      accepted: false,
    };
    const result = decidePenaltyAcceptance(penalty, {
      playYardage: -3,
      playGainedFirstDown: false,
      situation: { down: 2, distance: 10, yardLine: 35 },
      offenseTeamId: "team-a",
    });
    assertEquals(result, true);
  });

  await t.step(
    "declines defensive penalty when play gained more yards than penalty",
    () => {
      const penalty: PenaltyInfo = {
        type: "defensive_holding",
        phase: "post_snap",
        yardage: 5,
        automaticFirstDown: false,
        againstTeamId: "team-b",
        againstPlayerId: "cb1",
        accepted: false,
      };
      const result = decidePenaltyAcceptance(penalty, {
        playYardage: 15,
        playGainedFirstDown: true,
        situation: { down: 2, distance: 10, yardLine: 35 },
        offenseTeamId: "team-a",
      });
      assertEquals(result, false);
    },
  );

  await t.step(
    "accepts offensive penalty when play gained yardage (defense benefits)",
    () => {
      const penalty: PenaltyInfo = {
        type: "holding",
        phase: "post_snap",
        yardage: 10,
        automaticFirstDown: false,
        againstTeamId: "team-a",
        againstPlayerId: "ot1",
        accepted: false,
      };
      const result = decidePenaltyAcceptance(penalty, {
        playYardage: 12,
        playGainedFirstDown: true,
        situation: { down: 1, distance: 10, yardLine: 50 },
        offenseTeamId: "team-a",
      });
      assertEquals(result, true);
    },
  );

  await t.step("declines offensive penalty when play lost yardage", () => {
    const penalty: PenaltyInfo = {
      type: "holding",
      phase: "post_snap",
      yardage: 10,
      automaticFirstDown: false,
      againstTeamId: "team-a",
      againstPlayerId: "ot1",
      accepted: false,
    };
    const result = decidePenaltyAcceptance(penalty, {
      playYardage: -5,
      playGainedFirstDown: false,
      situation: { down: 3, distance: 10, yardLine: 50 },
      offenseTeamId: "team-a",
    });
    assertEquals(result, false);
  });

  await t.step("pre-snap penalties are always accepted", () => {
    const penalty: PenaltyInfo = {
      type: "false_start",
      phase: "pre_snap",
      yardage: 5,
      automaticFirstDown: false,
      againstTeamId: "team-a",
      againstPlayerId: "ot1",
      accepted: false,
    };
    const result = decidePenaltyAcceptance(penalty, {
      playYardage: 20,
      playGainedFirstDown: true,
      situation: { down: 1, distance: 10, yardLine: 50 },
      offenseTeamId: "team-a",
    });
    assertEquals(result, true);
  });

  await t.step(
    "accepts defensive penalty with auto first down when offense didn't get first down",
    () => {
      const penalty: PenaltyInfo = {
        type: "defensive_pass_interference",
        phase: "post_snap",
        yardage: 15,
        automaticFirstDown: true,
        againstTeamId: "team-b",
        againstPlayerId: "cb1",
        accepted: false,
      };
      const result = decidePenaltyAcceptance(penalty, {
        playYardage: 4,
        playGainedFirstDown: false,
        situation: { down: 3, distance: 8, yardLine: 40 },
        offenseTeamId: "team-a",
      });
      assertEquals(result, true);
    },
  );
});
