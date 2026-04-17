import { assertEquals } from "@std/assert/equals";
import { assert } from "@std/assert/assert";
import { generateCalibrationLeague } from "./generate-calibration-league.ts";
import { CALIBRATION_SEED } from "./calibration-seed.ts";
import { NEUTRAL_BUCKETS, type NeutralBucket } from "@zone-blitz/shared";

// Run the calibration invariants across multiple seeds and a larger
// sample size than the 32-team default. A single fixture league can
// pass by luck; sweeping several seeds × 128 teams (384 teams total)
// exercises the generator's statistical properties more honestly while
// still running in milliseconds.
const SEEDS = [CALIBRATION_SEED, 0xA11CE_11, 0xDEADBEEF] as const;
const TEAM_COUNT = 128;

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

function forEachSeed(
  name: string,
  fn: (seed: number) => void,
) {
  for (const seed of SEEDS) {
    Deno.test(`${name} [seed=0x${seed.toString(16)}]`, () => fn(seed));
  }
}

forEachSeed("generates the requested number of teams", (seed) => {
  const league = generateCalibrationLeague({ seed, teamCount: TEAM_COUNT });
  assertEquals(league.teams.length, TEAM_COUNT);
});

forEachSeed("records the seed used", (seed) => {
  const league = generateCalibrationLeague({ seed, teamCount: TEAM_COUNT });
  assertEquals(league.calibrationSeed, seed);
});

forEachSeed("each team has the expected starter count", (seed) => {
  const league = generateCalibrationLeague({ seed, teamCount: TEAM_COUNT });
  for (const team of league.teams) {
    assertEquals(
      team.starters.length,
      TOTAL_STARTERS,
      `team ${team.teamId} starters: expected ${TOTAL_STARTERS}, got ${team.starters.length}`,
    );
  }
});

forEachSeed("each team has bench players", (seed) => {
  const league = generateCalibrationLeague({ seed, teamCount: TEAM_COUNT });
  for (const team of league.teams) {
    assert(
      team.bench.length > 0,
      `team ${team.teamId} should have bench players`,
    );
  }
});

forEachSeed("starters cover every neutral bucket", (seed) => {
  const league = generateCalibrationLeague({ seed, teamCount: TEAM_COUNT });
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

forEachSeed("starters have the correct count per bucket", (seed) => {
  const league = generateCalibrationLeague({ seed, teamCount: TEAM_COUNT });
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

forEachSeed(
  "each team has a scheme fingerprint with offense and defense",
  (seed) => {
    const league = generateCalibrationLeague({ seed, teamCount: TEAM_COUNT });
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
  },
);

forEachSeed("each team has coaching mods", (seed) => {
  const league = generateCalibrationLeague({ seed, teamCount: TEAM_COUNT });
  for (const team of league.teams) {
    assertEquals(typeof team.coachingMods.schemeFitBonus, "number");
    assertEquals(typeof team.coachingMods.situationalBonus, "number");
  }
});

forEachSeed("all player attributes are numbers in [1, 99]", (seed) => {
  // Bounds follow the Geno Smith Line rating-scale contract
  // (RATING_MIN=1, RATING_MAX=99). Whichever generator is injected is
  // free to pick tighter per-attribute floors (production uses 5 for
  // non-signature, 15 for signature) — calibration just asserts the
  // scale-contract bounds, not the generator's internal tuning.
  const league = generateCalibrationLeague({ seed, teamCount: TEAM_COUNT });
  for (const team of league.teams) {
    for (const player of [...team.starters, ...team.bench]) {
      const attrs = player.attributes as unknown as Record<string, number>;
      for (const [key, value] of Object.entries(attrs)) {
        if (key.endsWith("Potential")) continue;
        assert(
          typeof value === "number" && value >= 1 && value <= 99,
          `player ${player.playerId} attr ${key} = ${value} out of range`,
        );
      }
    }
  }
});

forEachSeed(
  "running the generator twice with the same seed yields identical output",
  (seed) => {
    const run1 = generateCalibrationLeague({ seed, teamCount: TEAM_COUNT });
    const run2 = generateCalibrationLeague({ seed, teamCount: TEAM_COUNT });
    assertEquals(
      JSON.stringify(run1),
      JSON.stringify(run2),
      "generator must be deterministic — two runs with the same seed must produce identical output",
    );
  },
);

Deno.test("different seeds produce different leagues", () => {
  const [a, b, c] = SEEDS.map((seed) =>
    JSON.stringify(generateCalibrationLeague({ seed, teamCount: TEAM_COUNT }))
  );
  assert(a !== b, "seeds 0 and 1 must produce different output");
  assert(b !== c, "seeds 1 and 2 must produce different output");
  assert(a !== c, "seeds 0 and 2 must produce different output");
});

forEachSeed("unique team IDs", (seed) => {
  const league = generateCalibrationLeague({ seed, teamCount: TEAM_COUNT });
  const ids = league.teams.map((t) => t.teamId);
  assertEquals(ids.length, new Set(ids).size);
});

forEachSeed(
  "runPassLean is unimodal with sd ~5-9 (no bimodal gap)",
  (seed) => {
    // NFL play-calling tendency is roughly normally distributed, not
    // bimodal. Calibration teams must mirror that shape so the harness's
    // pass_rate / rush_rate spread bands are reachable. See issue #367.
    // Note: in the resolve-play model higher runPassLean → MORE passing,
    // so the center is set above 50 to land the league pass_rate near
    // the NFL band of ~0.58.
    const league = generateCalibrationLeague({ seed, teamCount: TEAM_COUNT });
    const values = league.teams.map((t) => {
      assert(t.fingerprint.offense !== null, "offense must be set");
      return t.fingerprint.offense.runPassLean;
    });
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) /
      values.length;
    const sd = Math.sqrt(variance);

    assert(
      mean >= 54 && mean <= 62,
      `runPassLean mean ${mean.toFixed(1)} should sit in 54-62`,
    );
    assert(
      sd >= 5 && sd <= 9,
      `runPassLean sd ${sd.toFixed(1)} should sit in 5-9`,
    );
    assert(
      Math.min(...values) >= 35 && Math.max(...values) <= 80,
      `runPassLean range [${Math.min(...values)}, ${
        Math.max(...values)
      }] should sit in 35-80`,
    );

    // Reject bimodality: at least 80% of teams should land in the
    // central 45-70 band. Unimodal ~N(58, 7) puts ~95% of mass here;
    // bimodal archetype clustering drops this below 55%.
    const inCenter = values.filter((v) => v >= 45 && v <= 70).length;
    const minInCenter = Math.ceil(TEAM_COUNT * 0.8);
    assert(
      inCenter >= minInCenter,
      `expected ≥${minInCenter} of ${TEAM_COUNT} teams with runPassLean in [45,70], got ${inCenter}`,
    );
  },
);

Deno.test("injected players generator is used in place of the default", () => {
  // Prove the seam is wired: a stub generator that returns zero
  // rostered players should produce zero starters + zero bench on
  // every team, regardless of seed.
  let calls = 0;
  const league = generateCalibrationLeague({
    seed: CALIBRATION_SEED,
    teamCount: 4,
    playersGenerator: {
      generate: () => {
        calls++;
        return { players: [] };
      },
      generateContracts: () => [],
    },
  });
  assertEquals(calls, 1);
  assertEquals(league.teams.length, 4);
  for (const team of league.teams) {
    assertEquals(team.starters.length, 0);
    assertEquals(team.bench.length, 0);
  }
});

Deno.test(
  "injected generator receives the calibration team IDs and roster size",
  () => {
    const captured: {
      leagueId: string;
      teamIds: string[];
      rosterSize: number;
    }[] = [];
    generateCalibrationLeague({
      seed: CALIBRATION_SEED,
      teamCount: 3,
      playersGenerator: {
        generate: (input) => {
          captured.push({
            leagueId: input.leagueId,
            teamIds: [...input.teamIds],
            rosterSize: input.rosterSize,
          });
          return { players: [] };
        },
        generateContracts: () => [],
      },
    });
    assertEquals(captured.length, 1, "generator must be invoked once");
    assertEquals(captured[0].teamIds, [
      "cal-team-0",
      "cal-team-1",
      "cal-team-2",
    ]);
    assertEquals(captured[0].rosterSize, 53);
  },
);

forEachSeed("unique player IDs across the entire league", (seed) => {
  const league = generateCalibrationLeague({ seed, teamCount: TEAM_COUNT });
  const allIds: string[] = [];
  for (const team of league.teams) {
    for (const p of [...team.starters, ...team.bench]) {
      allIds.push(p.playerId);
    }
  }
  assertEquals(allIds.length, new Set(allIds).size);
});
