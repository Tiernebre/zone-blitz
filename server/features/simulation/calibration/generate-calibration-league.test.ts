import { assertEquals } from "@std/assert/equals";
import { assert } from "@std/assert/assert";
import { generateCalibrationLeague } from "./generate-calibration-league.ts";
import { CALIBRATION_SEED } from "./calibration-seed.ts";
import { NEUTRAL_BUCKETS, type NeutralBucket } from "@zone-blitz/shared";

const TEAM_COUNT = 32;

const STARTER_SLOTS: Record<NeutralBucket, number> = {
  QB: 1,
  RB: 1,
  WR: 3,
  TE: 1,
  OT: 2,
  IOL: 3,
  EDGE: 2,
  IDL: 2,
  LB: 3,
  CB: 2,
  S: 2,
  K: 1,
  P: 1,
  LS: 1,
};

const TOTAL_STARTERS = Object.values(STARTER_SLOTS).reduce(
  (a, b) => a + b,
  0,
);

Deno.test("generates 32 teams", () => {
  const league = generateCalibrationLeague();
  assertEquals(league.teams.length, TEAM_COUNT);
});

Deno.test("uses the CALIBRATION_SEED", () => {
  const league = generateCalibrationLeague();
  assertEquals(league.calibrationSeed, CALIBRATION_SEED);
});

Deno.test("each team has the expected starter count", () => {
  const league = generateCalibrationLeague();
  for (const team of league.teams) {
    assertEquals(
      team.starters.length,
      TOTAL_STARTERS,
      `team ${team.teamId} starters: expected ${TOTAL_STARTERS}, got ${team.starters.length}`,
    );
  }
});

Deno.test("each team has bench players", () => {
  const league = generateCalibrationLeague();
  for (const team of league.teams) {
    assert(
      team.bench.length > 0,
      `team ${team.teamId} should have bench players`,
    );
  }
});

Deno.test("starters cover every neutral bucket", () => {
  const league = generateCalibrationLeague();
  for (const team of league.teams) {
    const bucketSet = new Set(team.starters.map((p) => p.neutralBucket));
    for (const bucket of NEUTRAL_BUCKETS) {
      assert(
        bucketSet.has(bucket),
        `team ${team.teamId} starters missing bucket ${bucket}`,
      );
    }
  }
});

Deno.test("starters have the correct count per bucket", () => {
  const league = generateCalibrationLeague();
  for (const team of league.teams) {
    const counts = new Map<NeutralBucket, number>();
    for (const p of team.starters) {
      counts.set(p.neutralBucket, (counts.get(p.neutralBucket) ?? 0) + 1);
    }
    for (const [bucket, expected] of Object.entries(STARTER_SLOTS)) {
      assertEquals(
        counts.get(bucket as NeutralBucket) ?? 0,
        expected,
        `team ${team.teamId} bucket ${bucket}: expected ${expected}, got ${
          counts.get(bucket as NeutralBucket) ?? 0
        }`,
      );
    }
  }
});

Deno.test("each team has a scheme fingerprint with offense and defense", () => {
  const league = generateCalibrationLeague();
  for (const team of league.teams) {
    assert(
      team.fingerprint.offense !== null,
      `team ${team.teamId} missing offensive tendencies`,
    );
    assert(
      team.fingerprint.defense !== null,
      `team ${team.teamId} missing defensive tendencies`,
    );
  }
});

Deno.test("each team has coaching mods", () => {
  const league = generateCalibrationLeague();
  for (const team of league.teams) {
    assertEquals(typeof team.coachingMods.schemeFitBonus, "number");
    assertEquals(typeof team.coachingMods.situationalBonus, "number");
  }
});

Deno.test("all player attributes are numbers in [25, 99]", () => {
  const league = generateCalibrationLeague();
  for (const team of league.teams) {
    for (const player of [...team.starters, ...team.bench]) {
      const attrs = player.attributes as unknown as Record<string, number>;
      for (const [key, value] of Object.entries(attrs)) {
        if (key.endsWith("Potential")) continue;
        assert(
          typeof value === "number" && value >= 25 && value <= 99,
          `player ${player.playerId} attr ${key} = ${value} out of range`,
        );
      }
    }
  }
});

Deno.test("running the generator twice yields identical output", () => {
  const run1 = generateCalibrationLeague();
  const run2 = generateCalibrationLeague();
  assertEquals(
    JSON.stringify(run1),
    JSON.stringify(run2),
    "generator must be deterministic — two runs must produce identical output",
  );
});

Deno.test("unique team IDs", () => {
  const league = generateCalibrationLeague();
  const ids = league.teams.map((t) => t.teamId);
  assertEquals(ids.length, new Set(ids).size);
});

Deno.test("unique player IDs across the entire league", () => {
  const league = generateCalibrationLeague();
  const allIds: string[] = [];
  for (const team of league.teams) {
    for (const p of [...team.starters, ...team.bench]) {
      allIds.push(p.playerId);
    }
  }
  assertEquals(allIds.length, new Set(allIds).size);
});
