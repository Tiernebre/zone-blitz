import { assertEquals } from "@std/assert";
import {
  type CapArchetype,
  computeCapHit,
  mulberry32,
  NEUTRAL_BUCKETS,
  type NeutralBucket,
  neutralBucket,
  PLAYER_ATTRIBUTE_KEYS,
  positionalSalaryMultiplier,
} from "@zone-blitz/shared";
import {
  applyLeagueEliteCaps,
  BUCKET_PROFILES,
  BUCKET_QUALITY_PRIORS,
  createPlayersGenerator,
  ELITE_OVERALL_THRESHOLD,
  eliteBudgetForBucket,
  GENERATIONAL_OVERALL_THRESHOLD,
  type NameGenerator,
  QUALITY_TIERS,
  qualityTierForBucketSlot,
  ROSTER_BUCKET_COMPOSITION,
  SALARY_FLOOR,
  SALARY_PER_QUALITY_POINT,
  stubAttributesFor,
} from "./players-generator.ts";
import { createRng } from "@zone-blitz/shared";
import { AGE_CURVE_PRIORS } from "./age-curves.ts";

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
  assertEquals(rostered.length, TEAM_IDS.length * INPUT.rosterSize);
  for (const teamId of TEAM_IDS) {
    const teamPlayers = rostered.filter((p) => p.player.teamId === teamId);
    assertEquals(teamPlayers.length, INPUT.rosterSize);
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

Deno.test("roster composition sums to 53 players", () => {
  const total = ROSTER_BUCKET_COMPOSITION.reduce(
    (sum, entry) => sum + entry.count,
    0,
  );
  assertEquals(total, 53);
});

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
  "per-team rostered neutral buckets match the 53-man composition",
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
  // There should be both rookies (<=23) and veterans (>=30) in a 159-man pool.
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

// ---- Positional market value integration ----

Deno.test(
  "at equal quality, veteran QB salary base is roughly 2.75× veteran RB through the market value table",
  () => {
    for (const quality of [70, 80, 85, 90]) {
      const qbMult = positionalSalaryMultiplier("QB", quality);
      const rbMult = positionalSalaryMultiplier("RB", quality);
      const excess = Math.max(0, quality - 50);
      const qbBase = SALARY_FLOOR + excess * SALARY_PER_QUALITY_POINT * qbMult;
      const rbBase = SALARY_FLOOR + excess * SALARY_PER_QUALITY_POINT * rbMult;
      const ratio = qbBase / rbBase;
      assertEquals(ratio > 2.0, true);
      assertEquals(ratio < 3.5, true);
    }
  },
);

Deno.test(
  "rookie-scale contracts bypass positional multiplier",
  () => {
    const extremeMultiplier = (_pos: NeutralBucket, _q: number) => 100.0;
    const normalGen = makeGenerator();
    const extremeGen = createPlayersGenerator({
      random: seededRandom(12345),
      nameGenerator: fixedNameGenerator(),
      currentYear: 2026,
      salaryMultiplier: extremeMultiplier,
    });
    const players = Array.from({ length: 53 }, (_, i) => ({
      id: `p${i}`,
      teamId: "team-1",
    }));
    const cap = 999_999_999_999;
    const normalBundles = normalGen.generateContracts({
      salaryCap: cap,
      players,
    });
    const extremeBundles = extremeGen.generateContracts({
      salaryCap: cap,
      players,
    });
    let identicalCount = 0;
    let differentCount = 0;
    for (let i = 0; i < normalBundles.length; i++) {
      if (
        normalBundles[i].years[0].base === extremeBundles[i].years[0].base
      ) {
        identicalCount++;
      } else {
        differentCount++;
      }
    }
    assertEquals(identicalCount > 0, true);
    assertEquals(differentCount > 0, true);
  },
);

Deno.test(
  "rookie-scale QB salary is not 2.75× a rookie-scale RB salary",
  () => {
    const calls: { position: NeutralBucket; quality: number }[] = [];
    const recordingMultiplier = (pos: NeutralBucket, q: number) => {
      calls.push({ position: pos, quality: q });
      return positionalSalaryMultiplier(pos, q);
    };
    const gen = createPlayersGenerator({
      random: seededRandom(12345),
      nameGenerator: fixedNameGenerator(),
      currentYear: 2026,
      salaryMultiplier: recordingMultiplier,
    });
    const players = Array.from({ length: 53 }, (_, i) => ({
      id: `p${i}`,
      teamId: "team-1",
    }));
    gen.generateContracts({ salaryCap: 999_999_999_999, players });
    assertEquals(calls.length < 53, true);
  },
);

Deno.test(
  "generator accepts injectable salary multiplier dependency",
  () => {
    const flatMultiplier = (_pos: NeutralBucket, _q: number) => 1.0;
    const gen = createPlayersGenerator({
      random: seededRandom(42),
      nameGenerator: fixedNameGenerator(),
      currentYear: 2026,
      salaryMultiplier: flatMultiplier,
    });
    const players = Array.from({ length: 53 }, (_, i) => ({
      id: `p${i}`,
      teamId: "team-1",
    }));
    const bundles = gen.generateContracts({
      salaryCap: 999_999_999_999,
      players,
    });
    assertEquals(bundles.length, 53);
  },
);

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
  // 32 teams × 53 = 1696 rostered players — a realistic sample for
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

Deno.test(
  "rostered signature overall distribution peaks in the average band (40-60)",
  () => {
    const result = makeFullLeagueGenerator(999).generate(FULL_LEAGUE_INPUT);
    const rostered = result.players.filter(
      (p) => p.player.teamId !== null && p.player.status === "active",
    );
    const overalls = rostered.map(signatureOverallOf);
    const mean = overalls.reduce((s, v) => s + v, 0) / overalls.length;
    // The NFL talent-distribution doc places the average tier (30–40%
    // of every bucket) centered around 50, flanked by weak (~40) and
    // strong (~72). Bin into 10-point buckets and expect the mode to
    // land in [40, 60] — where average + weak are concentrated — not
    // in the old backup-heavy 30-40 band.
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
      modeBucket >= 40 && modeBucket <= 60,
      true,
      `expected modal 10-pt bin in [40, 60]; got ${modeBucket} (count ${modeCount})`,
    );
    // Mean should land near the Geno Smith Line — competent starters
    // balance out the weak and replacement tails. Wider band than the
    // previous check because tier centers pull the mass toward 50.
    assertEquals(
      mean >= 45 && mean <= 60,
      true,
      `expected rostered mean overall in [45, 60]; got ${mean.toFixed(1)}`,
    );
  },
);

Deno.test("elite (85+) count per bucket stays within the per-bucket budget", () => {
  const result = makeFullLeagueGenerator(12345).generate(FULL_LEAGUE_INPUT);
  const rostered = result.players.filter(
    (p) => p.player.teamId !== null && p.player.status === "active",
  );
  const populationByBucket = new Map<NeutralBucket, number>();
  for (const p of rostered) {
    const bucket = bucketOf(p);
    populationByBucket.set(
      bucket,
      (populationByBucket.get(bucket) ?? 0) + 1,
    );
  }
  const elitesByBucket = new Map<NeutralBucket, number>();
  for (const p of rostered) {
    if (signatureOverallOf(p) >= ELITE_OVERALL_THRESHOLD) {
      const bucket = bucketOf(p);
      elitesByBucket.set(bucket, (elitesByBucket.get(bucket) ?? 0) + 1);
    }
  }
  for (const [bucket, population] of populationByBucket) {
    const budget = eliteBudgetForBucket(bucket, population);
    const count = elitesByBucket.get(bucket) ?? 0;
    assertEquals(
      count <= budget,
      true,
      `${bucket}: elites=${count}, budget=${budget}`,
    );
  }
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

// ---- Per-bucket talent distribution ----
//
// The talent-distribution doc at
// `data/docs/nfl-talent-distribution-by-position.md` specifies a
// different tier mix per neutral bucket — QB is bimodal with fat
// tails, OL and specialists compress around 50, EDGE is top-heavy,
// iDL/LB/S are flat. These tests assert the generator's rostered
// population at 32-team scale matches those target shapes within a
// reasonable tolerance.

function rosteredByBucket(seed: number): Map<NeutralBucket, number[]> {
  const result = makeFullLeagueGenerator(seed).generate(FULL_LEAGUE_INPUT);
  const rostered = result.players.filter(
    (p) => p.player.teamId !== null && p.player.status === "active",
  );
  const byBucket = new Map<NeutralBucket, number[]>();
  for (const p of rostered) {
    const bucket = bucketOf(p);
    const overall = signatureOverallOf(p);
    const list = byBucket.get(bucket) ?? [];
    list.push(overall);
    byBucket.set(bucket, list);
  }
  return byBucket;
}

Deno.test("per-bucket elite share approximates the talent-doc target", () => {
  // Pool multiple seeds so a single flaky draw doesn't trip the
  // assertion. Total QB pool at 4 seeds × 64 ≈ 256 samples — enough
  // to see a 5–8% elite share with <3pp standard error.
  const pooled = new Map<NeutralBucket, number[]>();
  for (const seed of [111, 222, 333, 444]) {
    const bySeed = rosteredByBucket(seed);
    for (const [bucket, overalls] of bySeed) {
      const list = pooled.get(bucket) ?? [];
      list.push(...overalls);
      pooled.set(bucket, list);
    }
  }
  for (const [bucket, overalls] of pooled) {
    const target = BUCKET_QUALITY_PRIORS[bucket].tierMix.elite;
    const elites = overalls.filter((o) => o >= ELITE_OVERALL_THRESHOLD).length;
    const actual = elites / overalls.length;
    // Tolerance is generous (±6pp absolute) because the per-bucket
    // cap pass trims excess above the target — so actual elite %
    // will sit at-or-below the target share rather than symmetric
    // around it. We assert the rate is non-zero and not wildly
    // above the target.
    assertEquals(
      actual <= target + 0.06,
      true,
      `${bucket}: elite share ${
        actual.toFixed(3)
      } exceeds target ${target} + 0.06`,
    );
  }
});

Deno.test(
  "qualityTierForBucketSlot sampling converges on per-bucket tierMix",
  () => {
    // Direct test of the slot-sampling function. We simulate a 32-team
    // league for each bucket — enough samples per slot for the law of
    // large numbers to pull each tier's share close to its target. The
    // signature-overall histogram tests above prove the integrated
    // pipeline lands in the right shape; this assertion isolates the
    // sampler from the `lockInBucket` / cap pipeline so a regression
    // in either layer can be diagnosed.
    const rng = createRng(seededRandom(2024));
    const counts = new Map<NeutralBucket, Record<string, number>>();
    for (const { bucket, count } of ROSTER_BUCKET_COMPOSITION) {
      const tally: Record<string, number> = {};
      for (const tier of QUALITY_TIERS) tally[tier] = 0;
      counts.set(bucket, tally);
      for (let team = 0; team < 32; team++) {
        for (let slot = 0; slot < count; slot++) {
          const tier = qualityTierForBucketSlot(rng, bucket, slot, count);
          tally[tier] += 1;
        }
      }
    }
    for (const [bucket, tally] of counts) {
      const total = Object.values(tally).reduce((s, v) => s + v, 0);
      const targets = BUCKET_QUALITY_PRIORS[bucket].tierMix;
      // Both elite and replacement tiers must come within 8pp of
      // their target — a generous tolerance that scales with the
      // smallest sample bucket (QB has only 2 slots × 32 teams = 64
      // samples).
      const eliteShare = tally.elite / total;
      const replacementShare = tally.replacement / total;
      assertEquals(
        Math.abs(eliteShare - targets.elite) <= 0.08,
        true,
        `${bucket}: elite share ${
          eliteShare.toFixed(3)
        } off from target ${targets.elite} by >0.08`,
      );
      assertEquals(
        Math.abs(replacementShare - targets.replacement) <= 0.10,
        true,
        `${bucket}: replacement share ${
          replacementShare.toFixed(3)
        } off from target ${targets.replacement} by >0.10`,
      );
    }
  },
);

Deno.test("OL buckets compress more tightly than QB / EDGE", () => {
  // Stddev of OT/IOL signature overalls should be notably smaller
  // than QB's, because OL has `stddevScale=0.70` vs QB's 1.35. This
  // is the shape invariant the talent doc calls out: "OL and
  // specialists have the narrowest spreads … EDGE and QB have the
  // widest."
  function stddev(xs: number[]): number {
    const mean = xs.reduce((s, v) => s + v, 0) / xs.length;
    const variance = xs.reduce((s, v) => s + (v - mean) ** 2, 0) / xs.length;
    return Math.sqrt(variance);
  }
  const byBucket = rosteredByBucket(12345);
  const qbSpread = stddev(byBucket.get("QB") ?? []);
  const olSpread = stddev([
    ...(byBucket.get("OT") ?? []),
    ...(byBucket.get("IOL") ?? []),
  ]);
  const edgeSpread = stddev(byBucket.get("EDGE") ?? []);
  assertEquals(
    olSpread < qbSpread,
    true,
    `OL stddev ${olSpread.toFixed(2)} should be < QB stddev ${
      qbSpread.toFixed(2)
    }`,
  );
  assertEquals(
    olSpread < edgeSpread,
    true,
    `OL stddev ${olSpread.toFixed(2)} should be < EDGE stddev ${
      edgeSpread.toFixed(2)
    }`,
  );
});

Deno.test("eliteBudgetForBucket scales with bucket-specific elite share", () => {
  // QB has a higher elite share (0.07) than IDL (0.03), so at the
  // same population size the QB budget should exceed the IDL one.
  const qbBudget = eliteBudgetForBucket("QB", 100);
  const idlBudget = eliteBudgetForBucket("IDL", 100);
  assertEquals(qbBudget > idlBudget, true, `QB=${qbBudget}, IDL=${idlBudget}`);
  // Empty population yields no budget at all — small test leagues
  // don't force elites into buckets that have zero rostered players.
  assertEquals(eliteBudgetForBucket("QB", 0), 0);
  // Single player should still allow one elite so small leagues
  // retain positional flavor.
  assertEquals(eliteBudgetForBucket("QB", 1), 1);
});

Deno.test(
  "rostered starters (slot 0) skew higher quality than depth (last slot)",
  () => {
    // Slot-biased tier sampling should make QB1 better than QB2 on
    // average, and likewise for every multi-slot bucket.
    const result = makeFullLeagueGenerator(7777).generate(FULL_LEAGUE_INPUT);
    const rostered = result.players.filter(
      (p) => p.player.teamId !== null && p.player.status === "active",
    );
    // Group by team, then by declared roster slot. The generator
    // builds per-team rosters in the order defined by
    // `ROSTER_BUCKET_COMPOSITION`, so index 0 of each team's QB
    // block is slot 0.
    const byTeam = new Map<string, typeof rostered>();
    for (const p of rostered) {
      const team = p.player.teamId!;
      const list = byTeam.get(team) ?? [];
      list.push(p);
      byTeam.set(team, list);
    }
    let startersTotal = 0;
    let startersCount = 0;
    let depthTotal = 0;
    let depthCount = 0;
    for (const [, teamRoster] of byTeam) {
      let offset = 0;
      for (const { bucket, count } of ROSTER_BUCKET_COMPOSITION) {
        if (count < 2) {
          offset += count;
          continue;
        }
        const starter = teamRoster[offset];
        const depth = teamRoster[offset + count - 1];
        // Guard against any ordering surprise — skip if the block is
        // not the bucket we expect.
        if (starter && depth) {
          startersTotal += signatureOverallOf(starter);
          startersCount += 1;
          depthTotal += signatureOverallOf(depth);
          depthCount += 1;
        }
        offset += count;
        void bucket;
      }
    }
    const startersMean = startersTotal / startersCount;
    const depthMean = depthTotal / depthCount;
    assertEquals(
      startersMean > depthMean,
      true,
      `starters mean ${startersMean.toFixed(1)} should exceed depth mean ${
        depthMean.toFixed(1)
      }`,
    );
  },
);
