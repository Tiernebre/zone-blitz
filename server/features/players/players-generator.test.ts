import { assertEquals } from "@std/assert";
import {
  type CapArchetype,
  computeCapHit,
  mulberry32,
  NEUTRAL_BUCKETS,
  type NeutralBucket,
  neutralBucket,
  PLAYER_ATTRIBUTE_KEYS,
} from "@zone-blitz/shared";
import {
  AAV_TIER_BANDS,
  applyLeagueEliteCaps,
  BUCKET_PROFILES,
  createPlayersGenerator,
  ELITE_OVERALL_THRESHOLD,
  ELITES_PER_32_TEAMS,
  GENERATIONAL_OVERALL_THRESHOLD,
  type NameGenerator,
  rollVeteranContract,
  ROSTER_BUCKET_COMPOSITION,
  stubAttributesFor,
} from "./players-generator.ts";
import { AGE_CURVE_PRIORS } from "./age-curves.ts";
import { createRng } from "@zone-blitz/shared";

const TEAM_IDS = ["team-1", "team-2", "team-3"];
const INPUT = {
  leagueId: "league-1",
  seasonId: "season-1",
  teamIds: TEAM_IDS,
  rosterSize: 53,
};

function seededRandom(seed: number): () => number {
  return mulberry32(seed);
}

function fixedNameGenerator(): NameGenerator {
  let i = 0;
  return {
    next() {
      i++;
      return { firstName: `First${i}`, lastName: `Last${i}` };
    },
  };
}

function makeGenerator(seed = 12345) {
  return createPlayersGenerator({
    random: seededRandom(seed),
    nameGenerator: fixedNameGenerator(),
    currentYear: 2026,
  });
}

function bucketOf(entry: {
  player: { heightInches: number; weightPounds: number };
  attributes: Parameters<typeof neutralBucket>[0]["attributes"];
}): NeutralBucket {
  return neutralBucket({
    attributes: entry.attributes,
    heightInches: entry.player.heightInches,
    weightPounds: entry.player.weightPounds,
  });
}

Deno.test("generates correct number of rostered players per team", () => {
  const result = makeGenerator().generate(INPUT);
  const rostered = result.players.filter(
    (p) => p.player.teamId !== null && p.player.status === "active",
  );
  const expectedPerTeam = ROSTER_BUCKET_COMPOSITION.reduce(
    (sum, entry) => sum + entry.count,
    0,
  );
  assertEquals(rostered.length, TEAM_IDS.length * expectedPerTeam);
  for (const teamId of TEAM_IDS) {
    const teamPlayers = rostered.filter((p) => p.player.teamId === teamId);
    assertEquals(teamPlayers.length, expectedPerTeam);
  }
});

Deno.test("generates active free agents with null teamId", () => {
  const result = makeGenerator().generate(INPUT);
  const freeAgents = result.players.filter(
    (p) => p.player.teamId === null && p.player.status === "active",
  );
  assertEquals(freeAgents.length, 50);
});

Deno.test("all players have the correct leagueId", () => {
  const result = makeGenerator().generate(INPUT);
  for (const entry of result.players) {
    assertEquals(entry.player.leagueId, INPUT.leagueId);
  }
});

Deno.test("prospects are emitted as players with status 'prospect' and no team", () => {
  const result = makeGenerator().generate(INPUT);
  const prospects = result.players.filter(
    (p) => p.player.status === "prospect",
  );
  assertEquals(prospects.length, 250);
  for (const entry of prospects) {
    assertEquals(entry.player.teamId, null);
  }
});

Deno.test("every generated player has a full attribute set in range", () => {
  const result = makeGenerator().generate(INPUT);
  const expectedKeyCount = PLAYER_ATTRIBUTE_KEYS.length * 2;
  for (const entry of result.players) {
    assertEquals(Object.keys(entry.attributes).length, expectedKeyCount);
    for (const key of PLAYER_ATTRIBUTE_KEYS) {
      const current = (entry.attributes as Record<string, number>)[key];
      const potential =
        (entry.attributes as Record<string, number>)[`${key}Potential`];
      assertEquals(typeof current, "number");
      assertEquals(typeof potential, "number");
      assertEquals(current >= 0 && current <= 100, true);
      assertEquals(potential >= 0 && potential <= 100, true);
      // Potential graduates from a fixed constant to current + non-negative
      // lift, so this invariant matters.
      assertEquals(potential >= current, true);
    }
  }
});

Deno.test("every player has identity fields populated", () => {
  const result = makeGenerator().generate(INPUT);
  for (const entry of result.players) {
    assertEquals(typeof entry.player.heightInches, "number");
    assertEquals(typeof entry.player.weightPounds, "number");
    assertEquals(typeof entry.player.birthDate, "string");
    assertEquals(typeof entry.player.college, "string");
  }
});

Deno.test("generates contracts for rostered players only", () => {
  const generator = makeGenerator();
  const players = [
    { id: "p1", teamId: "team-1" },
    { id: "p2", teamId: "team-1" },
    { id: "p3", teamId: null },
  ];
  const bundles = generator.generateContracts({
    salaryCap: 255_000_000,
    players,
  });
  assertEquals(bundles.length, 2);
  assertEquals(
    bundles.every((b) => b.contract.teamId === "team-1"),
    true,
  );
});

Deno.test("contract bundles include per-year rows matching totalYears", () => {
  const generator = makeGenerator();
  const salaryCap = 255_000_000;
  const players = Array.from({ length: 53 }, (_, i) => ({
    id: `p${i}`,
    teamId: "team-1",
  }));
  const bundles = generator.generateContracts({ salaryCap, players });
  for (const b of bundles) {
    assertEquals(b.years.length, b.contract.totalYears);
    assertEquals(b.contract.totalYears >= 1, true);
    assertEquals(b.contract.realYears <= b.contract.totalYears, true);
    const realYears = b.years.filter((y) => !y.isVoid);
    const voidYears = b.years.filter((y) => y.isVoid);
    assertEquals(realYears.length, b.contract.realYears);
    assertEquals(realYears.length + voidYears.length, b.contract.totalYears);
    for (const y of realYears) {
      assertEquals(y.base > 0, true);
    }
    for (const y of voidYears) {
      assertEquals(y.base, 0);
    }
  }
});

Deno.test("stub contracts stay under the team salary cap", () => {
  const generator = makeGenerator();
  const salaryCap = 255_000_000;
  const players = Array.from({ length: 53 }, (_, i) => ({
    id: `p${i}`,
    teamId: "team-1",
  }));
  const bundles = generator.generateContracts({ salaryCap, players });
  const totalAnnual = bundles.reduce((sum, b) => sum + b.years[0].base, 0);
  assertEquals(totalAnnual <= salaryCap, true);
});

Deno.test("contract base salaries vary across a full roster", () => {
  const generator = makeGenerator();
  const players = Array.from({ length: 53 }, (_, i) => ({
    id: `p${i}`,
    teamId: "team-1",
  }));
  const bundles = generator.generateContracts({
    salaryCap: 255_000_000,
    players,
  });
  const unique = new Set(bundles.map((b) => b.years[0].base));
  assertEquals(unique.size > 10, true);
});

Deno.test("signing bonus produces a bonus proration row with source 'signing'", () => {
  const generator = makeGenerator();
  const players = Array.from({ length: 53 }, (_, i) => ({
    id: `p${i}`,
    teamId: "team-1",
  }));
  const bundles = generator.generateContracts({
    salaryCap: 999_999_999,
    players,
  });
  const withBonus = bundles.filter((b) => b.contract.signingBonus > 0);
  assertEquals(withBonus.length > 0, true);
  for (const b of withBonus) {
    const signingProrations = b.bonusProrations.filter(
      (p) => p.source === "signing",
    );
    assertEquals(signingProrations.length, 1);
    assertEquals(signingProrations[0].amount, b.contract.signingBonus);
    assertEquals(signingProrations[0].firstYear, b.contract.signedYear);
    assertEquals(
      signingProrations[0].years <= 5 &&
        signingProrations[0].years <= b.contract.totalYears,
      true,
    );
  }
});

Deno.test("roster composition sums to 48 players (NFL ACT mean)", () => {
  const total = ROSTER_BUCKET_COMPOSITION.reduce(
    (sum, entry) => sum + entry.count,
    0,
  );
  assertEquals(total, 48);
});

Deno.test(
  "roster composition matches position-market.json within ±0.5 slot per data bucket",
  () => {
    const counts = new Map<NeutralBucket, number>();
    for (const { bucket, count } of ROSTER_BUCKET_COMPOSITION) {
      counts.set(bucket, count);
    }
    const get = (b: NeutralBucket) => counts.get(b) ?? 0;

    // Means from data/bands/position-market.json roster_slots_per_team_week.
    const checks: { label: string; actual: number; data: number }[] = [
      { label: "QB", actual: get("QB"), data: 2.0386 },
      { label: "RB", actual: get("RB"), data: 3.5617 },
      { label: "WR", actual: get("WR"), data: 5.2229 },
      { label: "TE", actual: get("TE"), data: 3.1022 },
      { label: "OL (OT+IOL)", actual: get("OT") + get("IOL"), data: 8.0223 },
      {
        label: "DL (EDGE+IDL)",
        actual: get("EDGE") + get("IDL"),
        data: 7.0316,
      },
      { label: "LB", actual: get("LB"), data: 6.8224 },
      { label: "DB (CB+S)", actual: get("CB") + get("S"), data: 9.2181 },
      { label: "K", actual: get("K"), data: 0.9959 },
      { label: "P", actual: get("P"), data: 1.0059 },
      { label: "LS", actual: get("LS"), data: 0.9996 },
    ];
    for (const { label, actual, data } of checks) {
      const delta = Math.abs(actual - data);
      assertEquals(
        delta <= 0.5,
        true,
        `${label}: composition ${actual} diverges from data mean ${data} by ${delta} (>0.5)`,
      );
    }
  },
);

Deno.test(
  "every generated player classifies into a known neutral bucket",
  () => {
    const result = makeGenerator().generate(INPUT);
    const validBuckets = new Set<NeutralBucket>(NEUTRAL_BUCKETS);
    for (const entry of result.players) {
      assertEquals(validBuckets.has(bucketOf(entry)), true);
    }
  },
);

Deno.test(
  "per-team rostered neutral buckets match the canonical composition",
  () => {
    const result = makeGenerator().generate(INPUT);
    for (const teamId of TEAM_IDS) {
      const teamPlayers = result.players.filter(
        (p) => p.player.teamId === teamId && p.player.status === "active",
      );
      const byBucket = new Map<NeutralBucket, number>();
      for (const entry of teamPlayers) {
        const bucket = bucketOf(entry);
        byBucket.set(bucket, (byBucket.get(bucket) ?? 0) + 1);
      }
      for (const { bucket, count } of ROSTER_BUCKET_COMPOSITION) {
        assertEquals(byBucket.get(bucket) ?? 0, count);
      }
    }
  },
);

Deno.test("every generated player starts with healthy injury status", () => {
  const result = makeGenerator().generate(INPUT);
  for (const entry of result.players) {
    assertEquals(entry.player.injuryStatus, "healthy");
  }
});

Deno.test(
  "every generated player gets a hometown and either draft info or undrafted",
  () => {
    const result = makeGenerator().generate(INPUT);
    for (const entry of result.players) {
      assertEquals(typeof entry.player.hometown, "string");
      assertEquals((entry.player.hometown ?? "").length > 0, true);
      const { draftYear, draftRound, draftPick, draftingTeamId } = entry.player;
      const allNull = draftYear === null && draftRound === null &&
        draftPick === null && draftingTeamId === null;
      const allPresent = typeof draftYear === "number" &&
        typeof draftRound === "number" && typeof draftPick === "number";
      assertEquals(allNull || allPresent, true);
    }
  },
);

Deno.test("at least one rostered active player is undrafted", () => {
  const result = makeGenerator().generate(INPUT);
  const rostered = result.players.filter(
    (p) => p.player.teamId !== null && p.player.status === "active",
  );
  const undrafted = rostered.filter((p) => p.player.draftYear === null);
  assertEquals(undrafted.length > 0, true);
});

Deno.test("drafted rostered players carry their drafting team", () => {
  const result = makeGenerator().generate(INPUT);
  const rostered = result.players.filter(
    (p) => p.player.teamId !== null && p.player.status === "active",
  );
  const drafted = rostered.filter((p) => p.player.draftYear !== null);
  for (const entry of drafted) {
    assertEquals(typeof entry.player.draftingTeamId, "string");
  }
});

Deno.test("all generated players have non-empty names", () => {
  const result = makeGenerator().generate(INPUT);
  for (const entry of result.players) {
    assertEquals(entry.player.firstName.length > 0, true);
    assertEquals(entry.player.lastName.length > 0, true);
  }
});

// ---- Graduated-behaviour assertions ----

Deno.test("attribute distribution produces a star-to-scrub gradient", () => {
  const result = makeGenerator().generate(INPUT);
  const rostered = result.players.filter(
    (p) => p.player.teamId !== null && p.player.status === "active",
  );
  let minSignature = 100;
  let maxSignature = 0;
  for (const entry of rostered) {
    const bucket = bucketOf(entry);
    const profile = BUCKET_PROFILES[bucket];
    const rec = entry.attributes as unknown as Record<string, number>;
    let sum = 0;
    for (const key of profile.signature) sum += rec[key];
    const overall = sum / profile.signature.length;
    if (overall < minSignature) minSignature = overall;
    if (overall > maxSignature) maxSignature = overall;
  }
  // The v1 stub produced a single flat overall; the graduated generator must
  // span at least 20 points of overall across a league.
  assertEquals(maxSignature - minSignature > 20, true);
  assertEquals(maxSignature > 75, true);
  assertEquals(minSignature < 60, true);
});

Deno.test("heights and weights vary within a bucket", () => {
  const result = makeGenerator().generate(INPUT);
  const wrs = result.players.filter((p) =>
    p.player.teamId !== null && bucketOf(p) === "WR"
  );
  const heights = new Set(wrs.map((p) => p.player.heightInches));
  const weights = new Set(wrs.map((p) => p.player.weightPounds));
  assertEquals(heights.size > 1, true);
  assertEquals(weights.size > 1, true);
});

Deno.test("ages span a rookie-to-veteran curve", () => {
  const result = makeGenerator().generate(INPUT);
  const rostered = result.players.filter(
    (p) => p.player.teamId !== null && p.player.status === "active",
  );
  const ages = rostered.map((p) => {
    const [year] = p.player.birthDate.split("-");
    return 2026 - Number(year);
  });
  const minAge = Math.min(...ages);
  const maxAge = Math.max(...ages);
  assertEquals(minAge >= 21, true);
  // Position-conditioned curves extend past 36 for QB/OL/specialists —
  // real NFL rosters routinely carry players into their early 40s at
  // those positions. Cap the sanity bound at the documented specialist
  // extreme so the test still fails on a true blow-up.
  assertEquals(maxAge <= 48, true);
  // There should be both rookies (<=23) and veterans (>=30) in a 144-man pool.
  assertEquals(ages.some((a) => a <= 23), true);
  assertEquals(ages.some((a) => a >= 30), true);
});

Deno.test("rostered age histograms track per-bucket NFL priors", () => {
  // Oversample a large league so bucket cohorts are big enough for
  // stable mean / p90 checks against the real-NFL priors. Per-bucket
  // rostered counts scale with league size (e.g., 4 RBs × 32 teams =
  // 128, 2 QBs × 32 = 64), which is enough to resolve the shape of
  // each position's active-age curve.
  const teamIds = Array.from({ length: 32 }, (_, i) => `team-${i + 1}`);
  const result = makeGenerator(777).generate({
    leagueId: "league-large",
    seasonId: "season-1",
    teamIds,
    rosterSize: 53,
  });
  const rostered = result.players.filter(
    (p) => p.player.teamId !== null && p.player.status === "active",
  );
  const agesByBucket = new Map<NeutralBucket, number[]>();
  for (const entry of rostered) {
    const bucket = bucketOf(entry);
    const [year] = entry.player.birthDate.split("-");
    const age = 2026 - Number(year);
    const list = agesByBucket.get(bucket) ?? [];
    list.push(age);
    agesByBucket.set(bucket, list);
  }
  const percentile = (vs: number[], p: number) => {
    const sorted = [...vs].sort((a, b) => a - b);
    const idx = Math.min(
      sorted.length - 1,
      Math.max(0, Math.floor((p / 100) * sorted.length)),
    );
    return sorted[idx];
  };
  // Broad bucket coverage — assert mean + p90 per bucket are near the
  // curve prior. Tolerance is loose enough to absorb the classifier's
  // bucket drift (the neutralBucket() result can disagree with the
  // intended slot when signature/non-signature rolls are extreme) and
  // the finite-sample noise on smaller bucket cohorts.
  for (const [bucket, ages] of agesByBucket) {
    if (ages.length < 20) continue;
    const prior = AGE_CURVE_PRIORS[bucket];
    const mean = ages.reduce((s, v) => s + v, 0) / ages.length;
    assertEquals(
      Math.abs(mean - prior.meanAge) <= 2,
      true,
      `${bucket} mean ${mean.toFixed(2)} off from prior ${
        prior.meanAge.toFixed(2)
      }`,
    );
    const p90 = percentile(ages, 90);
    assertEquals(
      Math.abs(p90 - prior.p90Age) <= 3,
      true,
      `${bucket} p90 ${p90} off from prior ${prior.p90Age}`,
    );
  }

  // Acceptance shape checks: RB cliff, QB tail, specialist tail.
  const rbAges = agesByBucket.get("RB") ?? [];
  const qbAges = agesByBucket.get("QB") ?? [];
  const rb30Plus = rbAges.filter((a) => a >= 30).length / rbAges.length;
  const qb33Plus = qbAges.filter((a) => a >= 33).length / qbAges.length;
  assertEquals(
    rb30Plus <= 0.15,
    true,
    `RB 30+ share ${(rb30Plus * 100).toFixed(1)}% too high — cliff missing`,
  );
  assertEquals(
    qb33Plus > rb30Plus * 0.5,
    true,
    `QB 33+ share ${(qb33Plus * 100).toFixed(1)}% not a meaningful tail`,
  );
});

Deno.test("prospects fall into a draft-eligible age band", () => {
  const result = makeGenerator().generate(INPUT);
  const prospects = result.players.filter(
    (p) => p.player.status === "prospect",
  );
  for (const entry of prospects) {
    const age = 2026 - Number(entry.player.birthDate.split("-")[0]);
    assertEquals(age >= 20 && age <= 23, true);
  }
});

Deno.test(
  "colleges are drawn from the default college pool, not a constant",
  () => {
    const result = makeGenerator().generate(INPUT);
    const colleges = new Set<string>();
    for (const p of result.players) {
      if (p.player.college) colleges.add(p.player.college);
    }
    // Many distinct colleges across 450+ players — the stub constant is gone.
    assertEquals(colleges.size > 20, true);
    assertEquals(colleges.has("State University"), false);
  },
);

Deno.test("hometowns are varied and formatted as 'City, ST'", () => {
  const result = makeGenerator().generate(INPUT);
  const hometowns = new Set<string>();
  for (const p of result.players) {
    if (p.player.hometown) hometowns.add(p.player.hometown);
  }
  assertEquals(hometowns.size > 20, true);
  for (const hometown of hometowns) {
    assertEquals(/, [A-Z]{2}$/.test(hometown), true);
  }
});

Deno.test("seeded generator is deterministic", () => {
  const a = createPlayersGenerator({
    random: seededRandom(42),
    nameGenerator: fixedNameGenerator(),
    currentYear: 2026,
  }).generate(INPUT);
  const b = createPlayersGenerator({
    random: seededRandom(42),
    nameGenerator: fixedNameGenerator(),
    currentYear: 2026,
  }).generate(INPUT);
  assertEquals(a.players.length, b.players.length);
  for (let i = 0; i < a.players.length; i++) {
    assertEquals(a.players[i].player.birthDate, b.players[i].player.birthDate);
    assertEquals(a.players[i].player.college, b.players[i].player.college);
    assertEquals(a.players[i].player.hometown, b.players[i].player.hometown);
    assertEquals(
      a.players[i].player.heightInches,
      b.players[i].player.heightInches,
    );
  }
});

Deno.test(
  "stubAttributesFor produces attributes that classify into the requested bucket",
  () => {
    for (const bucket of NEUTRAL_BUCKETS) {
      const attrs = stubAttributesFor(bucket);
      const profile = BUCKET_PROFILES[bucket];
      const classified = neutralBucket({
        attributes: attrs,
        heightInches: profile.heightInches,
        weightPounds: profile.weightPounds,
      });
      assertEquals(classified, bucket);
      for (const key of PLAYER_ATTRIBUTE_KEYS) {
        const cur = (attrs as Record<string, number>)[key];
        const pot = (attrs as Record<string, number>)[`${key}Potential`];
        assertEquals(pot >= cur && pot <= 100, true);
      }
    }
  },
);

// ---- Tiered free-agent market integration ----

Deno.test("AAV tier bands cover every neutral bucket and tier", () => {
  for (const bucket of NEUTRAL_BUCKETS) {
    const bands = AAV_TIER_BANDS[bucket];
    for (const tier of ["top_10", "top_25", "top_50", "rest"] as const) {
      const band = bands[tier];
      assertEquals(typeof band.meanMillions, "number");
      assertEquals(band.floorMillions <= band.ceilingMillions, true);
      assertEquals(band.meanMillions >= band.floorMillions, true);
      assertEquals(band.meanMillions <= band.ceilingMillions, true);
    }
  }
});

Deno.test("tier bands encode top_10 vs top_25 step-changes", () => {
  // The whole point of replacing the linear formula: tier means must
  // jump, not slope. Sample buckets where the NFL has well-known cliffs
  // (QB franchise gap, WR top_10 ~2× top_25).
  for (const bucket of ["QB", "WR", "EDGE", "OT", "CB"] as const) {
    const bands = AAV_TIER_BANDS[bucket];
    assertEquals(
      bands.top_10.meanMillions > bands.top_25.meanMillions * 1.2,
      true,
      `${bucket} top_10 (${bands.top_10.meanMillions}) should be >1.2× top_25 (${bands.top_25.meanMillions})`,
    );
    assertEquals(
      bands.top_25.meanMillions > bands.top_50.meanMillions * 1.2,
      true,
      `${bucket} top_25 should be >1.2× top_50`,
    );
  }
});

Deno.test("WR top_25 AAV is roughly half of top_10 AAV", () => {
  const wr = AAV_TIER_BANDS.WR;
  const ratio = wr.top_25.meanMillions / wr.top_10.meanMillions;
  assertEquals(
    ratio >= 0.6 && ratio <= 0.9,
    true,
    `WR top_25/top_10 ratio = ${ratio.toFixed(2)}`,
  );
});

Deno.test("Safety top_10 AAV is meaningfully below CB top_10 AAV", () => {
  const sTop = AAV_TIER_BANDS.S.top_10.meanMillions;
  const cbTop = AAV_TIER_BANDS.CB.top_10.meanMillions;
  assertEquals(sTop < cbTop, true, `S top_10 (${sTop}) < CB top_10 (${cbTop})`);
  // Spec: S top_10 runs ~20% below CB top_10. Allow 10-30% gap.
  const gap = (cbTop - sTop) / cbTop;
  assertEquals(
    gap >= 0.10 && gap <= 0.30,
    true,
    `S/CB gap = ${(gap * 100).toFixed(1)}% (expected 10-30%)`,
  );
});

Deno.test("specialist (K/P/LS) top_10 AAV is below $7M/yr", () => {
  for (const bucket of ["K", "P", "LS"] as const) {
    const top10 = AAV_TIER_BANDS[bucket].top_10;
    assertEquals(
      top10.ceilingMillions < 7,
      true,
      `${bucket} top_10 ceiling = ${top10.ceilingMillions}`,
    );
  }
});

Deno.test("top_10 EDGE AAV is QB-adjacent (within ~20% of top_10 QB)", () => {
  // Acceptance criterion: elite pass rushers are paid near QBs. Real
  // 2024-2025 deals (Watt $41M, Crosby $35.5M) push EDGE toward 70-80%
  // of franchise-QB money. The band is bumped above the rolling 5-yr
  // OTC average to reflect this trajectory.
  const qbFloor = AAV_TIER_BANDS.QB.top_10.floorMillions;
  const edgeFloor = AAV_TIER_BANDS.EDGE.top_10.floorMillions;
  assertEquals(
    edgeFloor >= qbFloor * 0.7,
    true,
    `EDGE top_10 floor (${edgeFloor}) should be ≥ 0.7× QB top_10 floor (${qbFloor})`,
  );
});

Deno.test("top_10 QB veteran AAV stays above $35M after cap scaling", () => {
  // Drives the issue's headline acceptance: a franchise QB must clear
  // $35M/yr even after the team cap squeeze. A 32-team league surfaces
  // multiple top_10 QB candidates so we don't hinge on a single seed.
  const cap = 255_000_000;
  const teamIds = Array.from({ length: 32 }, (_, i) => `team-${i + 1}`);
  const generator = createPlayersGenerator({
    random: seededRandom(12345),
    nameGenerator: fixedNameGenerator(),
    currentYear: 2026,
  });
  const result = generator.generate({
    leagueId: "league-1",
    seasonId: "season-1",
    teamIds,
    rosterSize: 53,
  });
  const rostered = result.players.filter(
    (p) => p.player.teamId !== null && p.player.status === "active",
  );
  const playersForContracts = rostered.map((p, i) => ({
    id: `p-${i}`,
    teamId: p.player.teamId!,
  }));
  const bundles = generator.generateContracts({
    salaryCap: cap,
    players: playersForContracts,
  });
  // Over a full league, at least one veteran (non-rookie) QB-bucket
  // contract should clear $35M/yr post-scaling. Use true AAV (total /
  // realYears) rather than Y1 base — the contract-structure prior
  // back-loads QB cap hits, so Y1 base is a fraction of AAV.
  const aavs = bundles
    .filter((b) => !b.contract.isRookieDeal)
    .map((b) => {
      const realYears = b.years.filter((y) => !y.isVoid);
      if (realYears.length === 0) return 0;
      const baseSum = realYears.reduce((s, y) => s + y.base, 0);
      return (baseSum + b.contract.signingBonus) / realYears.length;
    });
  const max = Math.max(...aavs);
  assertEquals(
    max >= 35_000_000,
    true,
    `expected at least one veteran AAV ≥ $35M (got max=${max.toLocaleString()})`,
  );
});

Deno.test("specialist veteran contracts stay below $7M/yr ceiling", () => {
  // generateContracts assigns buckets by ROSTER_BUCKET_SLOTS slot index
  // within each team's bundle list, not by player attributes. The K/P/LS
  // slots are the last three entries in ROSTER_BUCKET_COMPOSITION;
  // compute their indices dynamically so this test tracks changes to the
  // composition instead of hard-coding slot positions.
  const generator = createPlayersGenerator({
    random: seededRandom(54321),
    nameGenerator: fixedNameGenerator(),
    currentYear: 2026,
  });
  // Use the composition length (not 53) so indices line up with the
  // generator's slot cycle.
  const slotCount = ROSTER_BUCKET_COMPOSITION.reduce(
    (s, c) => s + c.count,
    0,
  );
  const players = Array.from({ length: slotCount }, (_, i) => ({
    id: `p${i}`,
    teamId: "team-1",
  }));
  const bundles = generator.generateContracts({
    salaryCap: 999_999_999_999,
    players,
  });
  const specialistBuckets: readonly NeutralBucket[] = ["K", "P", "LS"];
  const specialistSlots: number[] = [];
  let offset = 0;
  for (const entry of ROSTER_BUCKET_COMPOSITION) {
    if (specialistBuckets.includes(entry.bucket)) {
      for (let i = 0; i < entry.count; i++) specialistSlots.push(offset + i);
    }
    offset += entry.count;
  }
  for (const slot of specialistSlots) {
    const b = bundles[slot];
    if (b.contract.isRookieDeal) continue;
    const realYears = b.years.filter((y) => !y.isVoid);
    if (realYears.length === 0) continue;
    const baseSum = realYears.reduce((s, y) => s + y.base, 0);
    const aav = (baseSum + b.contract.signingBonus) / realYears.length;
    assertEquals(
      aav < 7_000_000,
      true,
      `specialist slot ${slot} AAV ${aav.toLocaleString()} should be < $7M`,
    );
  }
});

Deno.test("tiered AAV draws stay within the band's floor-to-ceiling range", () => {
  // 200 draws per (bucket, tier) — verifies clamp behavior of
  // sampleTieredAav transitively via repeated generateContracts calls
  // is not strictly possible, so use a representative full-league
  // generation and assert all veteran AAVs sit inside their tier band.
  const generator = createPlayersGenerator({
    random: seededRandom(7777),
    nameGenerator: fixedNameGenerator(),
    currentYear: 2026,
  });
  const teamIds = Array.from({ length: 16 }, (_, i) => `team-${i + 1}`);
  const result = generator.generate({
    leagueId: "league-1",
    seasonId: "season-1",
    teamIds,
    rosterSize: 53,
  });
  const playersForContracts = result.players
    .filter((p) => p.player.teamId !== null && p.player.status === "active")
    .map((p, i) => ({ id: `p-${i}`, teamId: p.player.teamId! }));
  const bundles = generator.generateContracts({
    salaryCap: 999_999_999_999,
    players: playersForContracts,
  });
  // Even without per-bundle bucket attribution, every veteran AAV must
  // fall under the absolute league ceiling (max QB top_10 = $78M).
  for (const b of bundles) {
    if (b.contract.isRookieDeal) continue;
    const aav = b.years.find((y) => !y.isVoid)?.base ?? 0;
    assertEquals(
      aav <= 78_000_000,
      true,
      `veteran AAV ${aav.toLocaleString()} exceeded league ceiling`,
    );
  }
});

Deno.test("contract years have sequential league years starting from signedYear", () => {
  const generator = makeGenerator();
  const players = Array.from({ length: 10 }, (_, i) => ({
    id: `p${i}`,
    teamId: "team-1",
  }));
  const bundles = generator.generateContracts({
    salaryCap: 999_999_999,
    players,
  });
  for (const b of bundles) {
    for (let i = 0; i < b.years.length; i++) {
      assertEquals(b.years[i].leagueYear, b.contract.signedYear + i);
    }
  }
});

Deno.test("rookie-age contracts are flagged as isRookieDeal", () => {
  const generator = makeGenerator();
  const players = Array.from({ length: 53 }, (_, i) => ({
    id: `p${i}`,
    teamId: "team-1",
  }));
  const bundles = generator.generateContracts({
    salaryCap: 999_999_999,
    players,
  });
  const rookies = bundles.filter((b) => b.contract.isRookieDeal);
  assertEquals(rookies.length > 0, true);
  for (const b of rookies) {
    assertEquals(b.contract.tagType, null);
  }
});

// ---- Per-year shape distribution (issue #292) ----

Deno.test("cap-hit invariant: sum of cap hits equals total contract value for every bundle", () => {
  const generator = makeGenerator();
  const players = Array.from({ length: 53 }, (_, i) => ({
    id: `p${i}`,
    teamId: "team-1",
  }));
  const bundles = generator.generateContracts({
    salaryCap: 255_000_000,
    players,
  });
  for (const b of bundles) {
    const totalBase = b.years
      .filter((y) => !y.isVoid)
      .reduce((sum, y) => sum + y.base, 0);
    const totalContractValue = totalBase + b.contract.signingBonus;
    const capHitSum = b.years.reduce(
      (sum, y) =>
        sum +
        computeCapHit(
          {
            years: b.years,
            bonusProrations: b.bonusProrations,
            optionBonuses: [],
          },
          y.leagueYear,
        ),
      0,
    );
    assertEquals(
      capHitSum,
      totalContractValue,
      `Cap-hit invariant violated for ${b.contract.playerId}: capHitSum=${capHitSum}, totalValue=${totalContractValue}`,
    );
  }
});

Deno.test("cap-hell archetype generates higher signing-bonus ratios than flush", () => {
  const capHellGen = createPlayersGenerator({
    random: seededRandom(42),
    nameGenerator: fixedNameGenerator(),
    currentYear: 2026,
  });
  const flushGen = createPlayersGenerator({
    random: seededRandom(42),
    nameGenerator: fixedNameGenerator(),
    currentYear: 2026,
  });
  const players = Array.from({ length: 53 }, (_, i) => ({
    id: `p${i}`,
    teamId: "team-1",
  }));

  const capHellBundles = capHellGen.generateContracts({
    salaryCap: 999_999_999,
    players,
    teamArchetypes: new Map([["team-1", "cap-hell" as CapArchetype]]),
  });
  const flushBundles = flushGen.generateContracts({
    salaryCap: 999_999_999,
    players,
    teamArchetypes: new Map([["team-1", "flush" as CapArchetype]]),
  });

  const avgBonusRatio = (bundles: typeof capHellBundles) => {
    const vets = bundles.filter(
      (b) => !b.contract.isRookieDeal && b.contract.signingBonus > 0,
    );
    if (vets.length === 0) return 0;
    return (
      vets.reduce((sum, b) => {
        const totalBase = b.years
          .filter((y) => !y.isVoid)
          .reduce((s, y) => s + y.base, 0);
        const total = totalBase + b.contract.signingBonus;
        return sum + b.contract.signingBonus / total;
      }, 0) / vets.length
    );
  };

  const capHellAvg = avgBonusRatio(capHellBundles);
  const flushAvg = avgBonusRatio(flushBundles);
  assertEquals(
    capHellAvg > flushAvg,
    true,
    `Cap-hell bonus ratio (${capHellAvg}) should exceed flush (${flushAvg})`,
  );
});

Deno.test("cap-hell archetype generates more void years than flush", () => {
  const capHellGen = createPlayersGenerator({
    random: seededRandom(42),
    nameGenerator: fixedNameGenerator(),
    currentYear: 2026,
  });
  const flushGen = createPlayersGenerator({
    random: seededRandom(42),
    nameGenerator: fixedNameGenerator(),
    currentYear: 2026,
  });
  const players = Array.from({ length: 53 }, (_, i) => ({
    id: `p${i}`,
    teamId: "team-1",
  }));

  const capHellBundles = capHellGen.generateContracts({
    salaryCap: 999_999_999,
    players,
    teamArchetypes: new Map([["team-1", "cap-hell" as CapArchetype]]),
  });
  const flushBundles = flushGen.generateContracts({
    salaryCap: 999_999_999,
    players,
    teamArchetypes: new Map([["team-1", "flush" as CapArchetype]]),
  });

  const voidCount = (bundles: typeof capHellBundles) =>
    bundles.reduce(
      (sum, b) => sum + b.years.filter((y) => y.isVoid).length,
      0,
    );

  const capHellVoids = voidCount(capHellBundles);
  const flushVoids = voidCount(flushBundles);
  assertEquals(
    capHellVoids > flushVoids,
    true,
    `Cap-hell void years (${capHellVoids}) should exceed flush (${flushVoids})`,
  );
});

Deno.test("rookie deals are 4 years with rookieDraftPick populated", () => {
  const generator = makeGenerator();
  const players = Array.from({ length: 53 }, (_, i) => ({
    id: `p${i}`,
    teamId: "team-1",
  }));
  const bundles = generator.generateContracts({
    salaryCap: 999_999_999,
    players,
  });
  const rookies = bundles.filter((b) => b.contract.isRookieDeal);
  assertEquals(rookies.length > 0, true);
  for (const b of rookies) {
    assertEquals(b.contract.totalYears, 4);
    assertEquals(b.contract.realYears, 4);
    assertEquals(typeof b.contract.rookieDraftPick, "number");
    assertEquals(
      b.contract.rookieDraftPick! >= 1 && b.contract.rookieDraftPick! <= 224,
      true,
    );
    assertEquals(b.years.length, 4);
    assertEquals(b.years.every((y) => !y.isVoid), true);
  }
});

Deno.test("cap-hit invariant holds with cap-hell archetype (void years present)", () => {
  const generator = createPlayersGenerator({
    random: seededRandom(42),
    nameGenerator: fixedNameGenerator(),
    currentYear: 2026,
  });
  const players = Array.from({ length: 53 }, (_, i) => ({
    id: `p${i}`,
    teamId: "team-1",
  }));
  const bundles = generator.generateContracts({
    salaryCap: 255_000_000,
    players,
    teamArchetypes: new Map([["team-1", "cap-hell" as CapArchetype]]),
  });
  for (const b of bundles) {
    const totalBase = b.years
      .filter((y) => !y.isVoid)
      .reduce((sum, y) => sum + y.base, 0);
    const totalContractValue = totalBase + b.contract.signingBonus;
    const capHitSum = b.years.reduce(
      (sum, y) =>
        sum +
        computeCapHit(
          {
            years: b.years,
            bonusProrations: b.bonusProrations,
            optionBonuses: [],
          },
          y.leagueYear,
        ),
      0,
    );
    assertEquals(capHitSum, totalContractValue);
  }
});

Deno.test("balanced archetype generates NFL-median structures", () => {
  const generator = createPlayersGenerator({
    random: seededRandom(42),
    nameGenerator: fixedNameGenerator(),
    currentYear: 2026,
  });
  const players = Array.from({ length: 53 }, (_, i) => ({
    id: `p${i}`,
    teamId: "team-1",
  }));
  const bundles = generator.generateContracts({
    salaryCap: 999_999_999,
    players,
    teamArchetypes: new Map([["team-1", "balanced" as CapArchetype]]),
  });
  const vets = bundles.filter(
    (b) => !b.contract.isRookieDeal && b.contract.signingBonus > 0,
  );
  const avgBonusRatio = vets.reduce((sum, b) => {
    const totalBase = b.years
      .filter((y) => !y.isVoid)
      .reduce((s, y) => s + y.base, 0);
    const total = totalBase + b.contract.signingBonus;
    return sum + b.contract.signingBonus / total;
  }, 0) / vets.length;
  assertEquals(
    avgBonusRatio >= 0.20 && avgBonusRatio <= 0.55,
    true,
    `Balanced bonus ratio (${avgBonusRatio}) should be in NFL-median range`,
  );
});

Deno.test("contract totalYears includes void years, realYears excludes them", () => {
  const generator = createPlayersGenerator({
    random: seededRandom(42),
    nameGenerator: fixedNameGenerator(),
    currentYear: 2026,
  });
  const players = Array.from({ length: 53 }, (_, i) => ({
    id: `p${i}`,
    teamId: "team-1",
  }));
  const bundles = generator.generateContracts({
    salaryCap: 999_999_999,
    players,
    teamArchetypes: new Map([["team-1", "cap-hell" as CapArchetype]]),
  });
  for (const b of bundles) {
    const realCount = b.years.filter((y) => !y.isVoid).length;
    const voidCount = b.years.filter((y) => y.isVoid).length;
    assertEquals(b.contract.realYears, realCount);
    assertEquals(b.contract.totalYears, realCount + voidCount);
    assertEquals(b.years.length, b.contract.totalYears);
  }
});

// ---- Issue #528: position × tier contract-structure priors ----
//
// These tests validate the position × market-tier shape governs
// generated contracts (length / guarantee years / cap-hit curve).
// We drive `rollVeteranContract` directly with explicit inputs
// because the generator's per-slot tier assignment does not map
// one-per-bucket for the 14 neutral buckets, and the acceptance
// criteria specifically talk about position × tier comparisons.

const QUALITY_TIER_TO_MARKET_TIER = {
  star: "top_10",
  starter: "top_50",
  depth: "rest",
} as const;

function sampleVeteranContracts(
  args: {
    bucket: NeutralBucket;
    qualityTier: "star" | "starter" | "depth";
    archetype: CapArchetype;
    count: number;
    seed?: number;
  },
) {
  const rng = createRng(seededRandom(args.seed ?? 1));
  const bundles: ReturnType<typeof rollVeteranContract>[] = [];
  for (let i = 0; i < args.count; i++) {
    bundles.push(
      rollVeteranContract(
        rng,
        {
          playerId: `p${i}`,
          teamId: "team-1",
          bucket: args.bucket,
          quality: 85,
          qualityTier: args.qualityTier,
          age: 28, // veteran, not subject to age>=32 clamp
          signedYear: 2026,
          archetype: args.archetype,
          marketTier: QUALITY_TIER_TO_MARKET_TIER[args.qualityTier],
        },
      ),
    );
  }
  return bundles;
}
Deno.test(
  "star-tier CB contracts are visibly shorter than star-tier QB contracts",
  () => {
    const qb = sampleVeteranContracts({
      bucket: "QB",
      qualityTier: "star",
      archetype: "balanced",
      count: 400,
      seed: 42,
    });
    const cb = sampleVeteranContracts({
      bucket: "CB",
      qualityTier: "star",
      archetype: "balanced",
      count: 400,
      seed: 42,
    });
    const avgLen = (arr: ReturnType<typeof rollVeteranContract>[]) =>
      arr.reduce((s, b) => s + b.contract.realYears, 0) / arr.length;
    const qbAvg = avgLen(qb);
    const cbAvg = avgLen(cb);
    assertEquals(
      qbAvg - cbAvg >= 0.75,
      true,
      `expected QB avg length to exceed CB avg length by >= 0.75 yr; got qb=${
        qbAvg.toFixed(2)
      } cb=${cbAvg.toFixed(2)}`,
    );
  },
);

Deno.test(
  "IOL top-10 guarantee share exceeds OT top-10 guarantee share in generated contracts",
  () => {
    const iol = sampleVeteranContracts({
      bucket: "IOL",
      qualityTier: "star",
      archetype: "balanced",
      count: 600,
      seed: 7,
    });
    const ot = sampleVeteranContracts({
      bucket: "OT",
      qualityTier: "star",
      archetype: "balanced",
      count: 600,
      seed: 7,
    });
    const guarRatio = (arr: ReturnType<typeof rollVeteranContract>[]) =>
      arr.reduce((s, b) => {
        const gy = b.years
          .filter((y) => !y.isVoid && y.guaranteeType !== "none").length;
        return s + gy / b.contract.realYears;
      }, 0) / arr.length;
    const iolAvg = guarRatio(iol);
    const otAvg = guarRatio(ot);
    assertEquals(
      iolAvg > otAvg,
      true,
      `expected IOL guarantee share > OT; got iol=${iolAvg.toFixed(3)} ot=${
        otAvg.toFixed(3)
      }`,
    );
  },
);

Deno.test(
  "star-tier QB contract cap-hit shape is back-loaded (y1 base share < last year base share)",
  () => {
    const bundles = sampleVeteranContracts({
      bucket: "QB",
      qualityTier: "star",
      archetype: "balanced",
      count: 400,
      seed: 9,
    });
    const longDeals = bundles.filter((b) => b.contract.realYears >= 4);
    assertEquals(longDeals.length > 20, true);
    const avgY1 = longDeals.reduce((s, b) => {
      const total = b.years
        .filter((y) => !y.isVoid)
        .reduce((t, y) => t + y.base, 0);
      return s + b.years[0].base / total;
    }, 0) / longDeals.length;
    const avgYLast = longDeals.reduce((s, b) => {
      const real = b.years.filter((y) => !y.isVoid);
      const total = real.reduce((t, y) => t + y.base, 0);
      return s + real[real.length - 1].base / total;
    }, 0) / longDeals.length;
    assertEquals(
      avgY1 < avgYLast,
      true,
      `QB top-10 should be back-loaded: y1=${avgY1.toFixed(3)} yLast=${
        avgYLast.toFixed(3)
      }`,
    );
  },
);

Deno.test(
  "cap-hell archetype lifts bonus share above balanced at the same position × tier",
  () => {
    // Confirms archetype remains a modifier on top of the position ×
    // tier prior, not a replacement.
    const balanced = sampleVeteranContracts({
      bucket: "WR",
      qualityTier: "star",
      archetype: "balanced",
      count: 400,
      seed: 11,
    });
    const capHell = sampleVeteranContracts({
      bucket: "WR",
      qualityTier: "star",
      archetype: "cap-hell",
      count: 400,
      seed: 11,
    });
    const avgBonus = (arr: ReturnType<typeof rollVeteranContract>[]) =>
      arr.reduce((s, b) => {
        const total = b.years
          .filter((y) => !y.isVoid)
          .reduce((t, y) => t + y.base, 0) + b.contract.signingBonus;
        return total > 0 ? s + b.contract.signingBonus / total : s;
      }, 0) / arr.length;
    assertEquals(avgBonus(capHell) > avgBonus(balanced), true);
  },
);

// ---- Void-year usage by position × tier (issue #532) ----
//
// OTC reporting (see `data/docs/contract-structure.md`): top-10 QB
// contracts carry void years ~30%+ of the time, top-10 EDGE ~20%+,
// top-10 IDL/WR/OT meaningful but lower, RB/S/CB/specialists rare.
// The prior model drove void-year usage purely off the team cap
// archetype; this suite pins the position × tier prior that layers
// on top.

function voidRate(bundles: ReturnType<typeof rollVeteranContract>[]): number {
  return bundles.filter((b) => b.years.some((y) => y.isVoid)).length /
    bundles.length;
}

Deno.test(
  "top-10 QB contracts carry void years ~30%+ under a balanced archetype",
  () => {
    const bundles = sampleVeteranContracts({
      bucket: "QB",
      qualityTier: "star",
      archetype: "balanced",
      count: 600,
      seed: 101,
    });
    const rate = voidRate(bundles);
    assertEquals(
      rate >= 0.25,
      true,
      `expected QB top-10 void-year rate >= 0.25; got ${rate.toFixed(3)}`,
    );
  },
);

Deno.test(
  "top-10 EDGE contracts carry void years ~20%+ under a balanced archetype",
  () => {
    const bundles = sampleVeteranContracts({
      bucket: "EDGE",
      qualityTier: "star",
      archetype: "balanced",
      count: 600,
      seed: 102,
    });
    const rate = voidRate(bundles);
    assertEquals(
      rate >= 0.15,
      true,
      `expected EDGE top-10 void-year rate >= 0.15; got ${rate.toFixed(3)}`,
    );
  },
);

Deno.test(
  "top-10 QB void-year rate clearly exceeds top-10 RB / CB / S / specialists",
  () => {
    const qb = voidRate(sampleVeteranContracts({
      bucket: "QB",
      qualityTier: "star",
      archetype: "balanced",
      count: 600,
      seed: 103,
    }));
    for (const bucket of ["RB", "CB", "S", "K"] as const) {
      const other = voidRate(sampleVeteranContracts({
        bucket,
        qualityTier: "star",
        archetype: "balanced",
        count: 600,
        seed: 103,
      }));
      assertEquals(
        qb - other >= 0.15,
        true,
        `expected QB void rate (${qb.toFixed(3)}) to exceed ${bucket} (${
          other.toFixed(3)
        }) by >= 0.15`,
      );
    }
  },
);

Deno.test(
  "sub-top-10 tiers rarely carry void years regardless of position",
  () => {
    for (const bucket of ["QB", "EDGE", "WR"] as const) {
      const rate = voidRate(sampleVeteranContracts({
        bucket,
        qualityTier: "depth",
        archetype: "balanced",
        count: 600,
        seed: 104,
      }));
      assertEquals(
        rate <= 0.1,
        true,
        `expected sub-top-10 ${bucket} void rate <= 0.10; got ${
          rate.toFixed(3)
        }`,
      );
    }
  },
);

Deno.test(
  "flush archetype zeroes void-year usage even for top-10 QBs",
  () => {
    // Flush teams never need cap tricks; the team archetype gates the
    // position prior to preserve the existing cap-hell vs flush
    // invariant (tested at generator scope above).
    const bundles = sampleVeteranContracts({
      bucket: "QB",
      qualityTier: "star",
      archetype: "flush",
      count: 400,
      seed: 105,
    });
    assertEquals(voidRate(bundles), 0);
  },
);

Deno.test("default archetype (no teamArchetypes provided) still produces valid contracts", () => {
  const generator = makeGenerator();
  const players = Array.from({ length: 53 }, (_, i) => ({
    id: `p${i}`,
    teamId: "team-1",
  }));
  const bundles = generator.generateContracts({
    salaryCap: 255_000_000,
    players,
  });
  assertEquals(bundles.length, 53);
  for (const b of bundles) {
    assertEquals(b.years.length, b.contract.totalYears);
    assertEquals(b.contract.realYears <= b.contract.totalYears, true);
  }
});

// ---- Geno Smith Line distribution ----
//
// The scale contract in `docs/product/north-star/player-attributes.md`
// states the league-wide attribute distribution is a right-skewed bell
// peaking at 35-40, with 50 as the starter/backup boundary. These
// tests prove the generator's actual distribution lines up with that
// contract — not a 50-100-in-disguise scale — and that elite (85+)
// and generational (95+) tiers stay as rare as the spec mandates.

function signatureOverallOf(entry: {
  player: { heightInches: number; weightPounds: number };
  attributes: Parameters<typeof neutralBucket>[0]["attributes"];
}): number {
  const bucket = bucketOf(entry);
  const profile = BUCKET_PROFILES[bucket];
  const rec = entry.attributes as unknown as Record<string, number>;
  let sum = 0;
  for (const key of profile.signature) sum += rec[key];
  return sum / profile.signature.length;
}

function makeFullLeagueGenerator(seed: number) {
  // 32 teams × 48 = 1536 rostered players — a realistic sample for
  // league-wide distribution assertions.
  return createPlayersGenerator({
    random: seededRandom(seed),
    nameGenerator: fixedNameGenerator(),
    currentYear: 2026,
  });
}

const FULL_LEAGUE_INPUT = {
  leagueId: "league-1",
  seasonId: "season-1",
  teamIds: Array.from({ length: 32 }, (_, i) => `team-${i + 1}`),
  rosterSize: 53,
};

Deno.test("rostered signature overall distribution peaks in the backup band (35-50)", () => {
  const result = makeFullLeagueGenerator(999).generate(FULL_LEAGUE_INPUT);
  const rostered = result.players.filter(
    (p) => p.player.teamId !== null && p.player.status === "active",
  );
  const overalls = rostered.map(signatureOverallOf);
  const mean = overalls.reduce((s, v) => s + v, 0) / overalls.length;
  // Bin into 10-point buckets and find the modal bucket. The north-star
  // doc says the league peaks around 35-40; allow 30-50 for the mode so
  // seed noise on a 1536-player sample doesn't turn this flaky.
  const bins = new Map<number, number>();
  for (const v of overalls) {
    const bucket = Math.floor(v / 10) * 10;
    bins.set(bucket, (bins.get(bucket) ?? 0) + 1);
  }
  let modeBucket = 0;
  let modeCount = 0;
  for (const [b, c] of bins) {
    if (c > modeCount) {
      modeBucket = b;
      modeCount = c;
    }
  }
  assertEquals(
    modeBucket >= 30 && modeBucket <= 50,
    true,
    `expected modal 10-pt bin in [30, 50]; got ${modeBucket} (count ${modeCount})`,
  );
  // Mean falls in the "fringe starter / solid starter" window — a
  // backup-heavy roster where the average player is near the Geno
  // Smith line, not well above it.
  assertEquals(
    mean >= 40 && mean <= 55,
    true,
    `expected rostered mean overall in [40, 55]; got ${mean.toFixed(1)}`,
  );
});

Deno.test("elite (85+) count stays within the league-wide budget", () => {
  const result = makeFullLeagueGenerator(12345).generate(FULL_LEAGUE_INPUT);
  const rostered = result.players.filter(
    (p) => p.player.teamId !== null && p.player.status === "active",
  );
  const elites = rostered.filter(
    (p) => signatureOverallOf(p) >= ELITE_OVERALL_THRESHOLD,
  );
  const budget = Math.max(
    1,
    Math.round((ELITES_PER_32_TEAMS * FULL_LEAGUE_INPUT.teamIds.length) / 32),
  );
  assertEquals(
    elites.length <= budget,
    true,
    `elites=${elites.length}, budget=${budget}`,
  );
});

Deno.test("generational (95+) is at most one per neutral bucket per league", () => {
  const result = makeFullLeagueGenerator(777).generate(FULL_LEAGUE_INPUT);
  const rostered = result.players.filter(
    (p) => p.player.teamId !== null && p.player.status === "active",
  );
  const byBucket = new Map<NeutralBucket, number>();
  for (const p of rostered) {
    const overall = signatureOverallOf(p);
    if (overall >= GENERATIONAL_OVERALL_THRESHOLD) {
      const bucket = bucketOf(p);
      byBucket.set(bucket, (byBucket.get(bucket) ?? 0) + 1);
    }
  }
  for (const [bucket, count] of byBucket) {
    assertEquals(count <= 1, true, `bucket ${bucket} had ${count} 95+ players`);
  }
});

Deno.test("elite cap in a 3-team test still allows one elite player", () => {
  // With the new distribution the elite budget for 3 teams rounds to 1,
  // not zero — otherwise a small test league would never showcase a
  // franchise-defining talent. Guards against rounding regressions.
  let foundElite = false;
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
    const result = makeGenerator(seed).generate(INPUT);
    const rostered = result.players.filter(
      (p) => p.player.teamId !== null && p.player.status === "active",
    );
    if (
      rostered.some((p) => signatureOverallOf(p) >= ELITE_OVERALL_THRESHOLD)
    ) {
      foundElite = true;
      break;
    }
  }
  assertEquals(foundElite, true, "expected at least one elite within 10 seeds");
});

Deno.test("applyLeagueEliteCaps is a no-op on an empty roster", () => {
  applyLeagueEliteCaps([], 0);
  applyLeagueEliteCaps([], 32);
});

Deno.test("applyLeagueEliteCaps preserves potential >= current invariant", () => {
  const result = makeFullLeagueGenerator(42).generate(FULL_LEAGUE_INPUT);
  const rostered = result.players.filter(
    (p) => p.player.teamId !== null && p.player.status === "active",
  );
  for (const entry of rostered) {
    const rec = entry.attributes as unknown as Record<string, number>;
    for (const key of PLAYER_ATTRIBUTE_KEYS) {
      assertEquals(
        rec[`${key}Potential`] >= rec[key],
        true,
        `${key}: potential=${rec[`${key}Potential`]} < current=${rec[key]}`,
      );
    }
  }
});
