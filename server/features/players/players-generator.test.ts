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
  createPlayersGenerator,
  ELITE_OVERALL_THRESHOLD,
  ELITES_PER_32_TEAMS,
  GENERATIONAL_OVERALL_THRESHOLD,
  type NameGenerator,
  ROSTER_BUCKET_COMPOSITION,
  SALARY_FLOOR,
  SALARY_PER_QUALITY_POINT,
  stubAttributesFor,
} from "./players-generator.ts";

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
  assertEquals(maxAge <= 36, true);
  // There should be both rookies (<=23) and veterans (>=30) in a 144-man pool.
  assertEquals(ages.some((a) => a <= 23), true);
  assertEquals(ages.some((a) => a >= 30), true);
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
