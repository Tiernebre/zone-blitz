import { assertEquals } from "@std/assert";
import {
  mulberry32,
  NEUTRAL_BUCKETS,
  type NeutralBucket,
  neutralBucket,
  PLAYER_ATTRIBUTE_KEYS,
  positionalSalaryMultiplier,
} from "@zone-blitz/shared";
import {
  BUCKET_PROFILES,
  createPlayersGenerator,
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
  const contracts = generator.generateContracts({
    salaryCap: 255_000_000,
    players,
  });
  assertEquals(contracts.length, 2);
  assertEquals(contracts.every((c) => c.teamId === "team-1"), true);
});

Deno.test("stub contracts stay under the team salary cap", () => {
  const generator = makeGenerator();
  const salaryCap = 255_000_000;
  const players = Array.from({ length: 53 }, (_, i) => ({
    id: `p${i}`,
    teamId: "team-1",
  }));
  const contracts = generator.generateContracts({ salaryCap, players });
  const totalAnnual = contracts.reduce((sum, c) => sum + c.annualSalary, 0);
  assertEquals(totalAnnual <= salaryCap, true);
  for (const c of contracts) {
    assertEquals(c.totalYears >= 1 && c.totalYears <= 5, true);
    assertEquals(c.currentYear, 1);
    assertEquals(c.totalSalary, c.annualSalary * c.totalYears);
  }
});

Deno.test("contract annual salaries vary across a full roster", () => {
  const generator = makeGenerator();
  const players = Array.from({ length: 53 }, (_, i) => ({
    id: `p${i}`,
    teamId: "team-1",
  }));
  const contracts = generator.generateContracts({
    salaryCap: 255_000_000,
    players,
  });
  const unique = new Set(contracts.map((c) => c.annualSalary));
  // Graduated generator replaces a single-value flat split with a distribution.
  assertEquals(unique.size > 10, true);
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

// ---- Graduated-behaviour assertions (ADR 0009) ----

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
  // There should be both rookies (<=23) and veterans (>=30) in a 159-man pool.
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

// ---- Positional market value integration (ADR 0011) ----

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
    const normalContracts = normalGen.generateContracts({
      salaryCap: cap,
      players,
    });
    const extremeContracts = extremeGen.generateContracts({
      salaryCap: cap,
      players,
    });
    let identicalCount = 0;
    let differentCount = 0;
    for (let i = 0; i < normalContracts.length; i++) {
      if (
        normalContracts[i].annualSalary === extremeContracts[i].annualSalary
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
    const contracts = gen.generateContracts({
      salaryCap: 999_999_999_999,
      players,
    });
    assertEquals(contracts.length, 53);
  },
);
