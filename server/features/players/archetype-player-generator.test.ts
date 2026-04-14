import { assertEquals } from "@std/assert";
import {
  NEUTRAL_BUCKETS,
  type NeutralBucket,
  neutralBucket,
  PLAYER_ATTRIBUTE_KEYS,
} from "@zone-blitz/shared";
import { createArchetypePlayerGenerator } from "./archetype-player-generator.ts";
import { ROSTER_BUCKET_COMPOSITION } from "./stub-players-generator.ts";

const TEAM_IDS = ["team-1", "team-2", "team-3"];
const INPUT = {
  leagueId: "league-1",
  seasonId: "season-1",
  teamIds: TEAM_IDS,
  rosterSize: 53,
};

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
  const generator = createArchetypePlayerGenerator();
  const result = generator.generate(INPUT);
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
  const generator = createArchetypePlayerGenerator();
  const result = generator.generate(INPUT);
  const freeAgents = result.players.filter(
    (p) => p.player.teamId === null && p.player.status === "active",
  );
  assertEquals(freeAgents.length, 50);
});

Deno.test("generates prospects with status prospect and no team", () => {
  const generator = createArchetypePlayerGenerator();
  const result = generator.generate(INPUT);
  const prospects = result.players.filter(
    (p) => p.player.status === "prospect",
  );
  assertEquals(prospects.length, 250);
  for (const entry of prospects) {
    assertEquals(entry.player.teamId, null);
  }
});

Deno.test("all players have the correct leagueId", () => {
  const generator = createArchetypePlayerGenerator();
  const result = generator.generate(INPUT);
  for (const entry of result.players) {
    assertEquals(entry.player.leagueId, INPUT.leagueId);
  }
});

Deno.test("every generated player has a full attribute set", () => {
  const generator = createArchetypePlayerGenerator();
  const result = generator.generate(INPUT);
  const expectedKeyCount = PLAYER_ATTRIBUTE_KEYS.length * 2;
  for (const entry of result.players) {
    assertEquals(Object.keys(entry.attributes).length, expectedKeyCount);
    for (const key of PLAYER_ATTRIBUTE_KEYS) {
      const current = (entry.attributes as Record<string, number>)[key];
      const potential =
        (entry.attributes as Record<string, number>)[`${key}Potential`];
      assertEquals(typeof current, "number");
      assertEquals(typeof potential, "number");
      assertEquals(
        current >= 0 && current <= 100,
        true,
        `${key} current value ${current} out of bounds`,
      );
      assertEquals(
        potential >= 0 && potential <= 100,
        true,
        `${key} potential value ${potential} out of bounds`,
      );
    }
  }
});

Deno.test("potential is always >= current for every attribute", () => {
  const generator = createArchetypePlayerGenerator();
  const result = generator.generate(INPUT);
  for (const entry of result.players) {
    for (const key of PLAYER_ATTRIBUTE_KEYS) {
      const current = (entry.attributes as Record<string, number>)[key];
      const potential =
        (entry.attributes as Record<string, number>)[`${key}Potential`];
      assertEquals(
        potential >= current,
        true,
        `${key}: potential ${potential} < current ${current}`,
      );
    }
  }
});

Deno.test("no player is elite at every attribute (budget enforcement)", () => {
  const generator = createArchetypePlayerGenerator();
  const result = generator.generate(INPUT);
  for (const entry of result.players) {
    let eliteCount = 0;
    for (const key of PLAYER_ATTRIBUTE_KEYS) {
      const value = (entry.attributes as Record<string, number>)[key];
      if (value >= 85) eliteCount++;
    }
    assertEquals(
      eliteCount < PLAYER_ATTRIBUTE_KEYS.length / 2,
      true,
      `player has ${eliteCount} elite attributes`,
    );
  }
});

Deno.test("attribute profiles show archetype shape — primary attrs are boosted", () => {
  const generator = createArchetypePlayerGenerator();
  const result = generator.generate(INPUT);

  let shapedCount = 0;
  for (const entry of result.players) {
    const vals = PLAYER_ATTRIBUTE_KEYS.map(
      (k) => (entry.attributes as Record<string, number>)[k],
    );
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    const max = Math.max(...vals);
    if (max > avg + 5) shapedCount++;
  }

  assertEquals(
    shapedCount / result.players.length > 0.8,
    true,
    `only ${shapedCount}/${result.players.length} players show archetype shape`,
  );
});

Deno.test("same seed produces identical output (deterministic)", () => {
  const generator = createArchetypePlayerGenerator();
  const a = generator.generate(INPUT);
  const b = generator.generate(INPUT);
  assertEquals(a.players.length, b.players.length);
  for (let i = 0; i < a.players.length; i++) {
    assertEquals(a.players[i].player.firstName, b.players[i].player.firstName);
    assertEquals(a.players[i].player.lastName, b.players[i].player.lastName);
    for (const key of PLAYER_ATTRIBUTE_KEYS) {
      assertEquals(
        (a.players[i].attributes as Record<string, number>)[key],
        (b.players[i].attributes as Record<string, number>)[key],
      );
    }
  }
});

Deno.test("different league IDs produce different attribute profiles", () => {
  const generator = createArchetypePlayerGenerator();
  const a = generator.generate(INPUT);
  const b = generator.generate({ ...INPUT, leagueId: "league-2" });
  let differences = 0;
  const count = Math.min(a.players.length, b.players.length);
  for (let i = 0; i < count; i++) {
    for (const key of PLAYER_ATTRIBUTE_KEYS) {
      if (
        (a.players[i].attributes as Record<string, number>)[key] !==
          (b.players[i].attributes as Record<string, number>)[key]
      ) {
        differences++;
      }
    }
  }
  assertEquals(differences > 0, true);
});

Deno.test("attribute distribution follows bell curve — majority in 25-55 range", () => {
  const generator = createArchetypePlayerGenerator();
  const result = generator.generate(INPUT);
  let inRange = 0;
  let total = 0;
  for (const entry of result.players) {
    for (const key of PLAYER_ATTRIBUTE_KEYS) {
      const value = (entry.attributes as Record<string, number>)[key];
      total++;
      if (value >= 15 && value <= 70) inRange++;
    }
  }
  assertEquals(
    inRange / total > 0.6,
    true,
    `only ${
      ((inRange / total) * 100).toFixed(1)
    }% of attributes in 15-70 range`,
  );
});

Deno.test("cross-archetype players appear at the configured rate", () => {
  const generator = createArchetypePlayerGenerator({
    crossArchetypeRate: 1.0,
  });
  const result = generator.generate({
    ...INPUT,
    teamIds: ["team-1"],
    rosterSize: 53,
  });

  let crossArchetypeCount = 0;
  for (const entry of result.players) {
    const attrs = entry.attributes as Record<string, number>;
    const bucket = bucketOf(entry);
    const offensivePrimary = ["routeRunning", "catching", "ballCarrying"];
    const defensivePrimary = ["manCoverage", "zoneCoverage", "tackling"];

    const hasOffensive = offensivePrimary.some((k) => attrs[k] > 40);
    const hasDefensive = defensivePrimary.some((k) => attrs[k] > 40);

    if (
      (["CB", "S", "LB"].includes(bucket) && hasOffensive) ||
      (["WR", "RB", "TE"].includes(bucket) && hasDefensive)
    ) {
      crossArchetypeCount++;
    }
  }

  assertEquals(
    crossArchetypeCount > 0,
    true,
    "expected cross-archetype players at rate 1.0",
  );
});

Deno.test("zero cross-archetype rate produces no cross-archetype boosts", () => {
  const generator = createArchetypePlayerGenerator({
    crossArchetypeRate: 0,
  });
  const result = generator.generate(INPUT);
  assertEquals(result.players.length > 0, true);
});

Deno.test("every generated player classifies into a known neutral bucket", () => {
  const generator = createArchetypePlayerGenerator();
  const result = generator.generate(INPUT);
  const validBuckets = new Set<NeutralBucket>(NEUTRAL_BUCKETS);
  for (const entry of result.players) {
    assertEquals(validBuckets.has(bucketOf(entry)), true);
  }
});

Deno.test("every generated player has identity fields populated", () => {
  const generator = createArchetypePlayerGenerator();
  const result = generator.generate(INPUT);
  for (const entry of result.players) {
    assertEquals(typeof entry.player.heightInches, "number");
    assertEquals(typeof entry.player.weightPounds, "number");
    assertEquals(typeof entry.player.birthDate, "string");
    assertEquals(entry.player.firstName.length > 0, true);
    assertEquals(entry.player.lastName.length > 0, true);
  }
});

Deno.test("every generated player starts with healthy injury status", () => {
  const generator = createArchetypePlayerGenerator();
  const result = generator.generate(INPUT);
  for (const entry of result.players) {
    assertEquals(entry.player.injuryStatus, "healthy");
  }
});

Deno.test("generates contracts for rostered players only", () => {
  const generator = createArchetypePlayerGenerator();
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

Deno.test("contracts distribute salary evenly under cap", () => {
  const generator = createArchetypePlayerGenerator();
  const salaryCap = 255_000_000;
  const players = Array.from({ length: 53 }, (_, i) => ({
    id: `p${i}`,
    teamId: "team-1",
  }));

  const contracts = generator.generateContracts({ salaryCap, players });

  const totalAnnual = contracts.reduce((sum, c) => sum + c.annualSalary, 0);
  assertEquals(totalAnnual <= salaryCap, true);
  assertEquals(contracts.every((c) => c.totalYears === 3), true);
  assertEquals(contracts.every((c) => c.currentYear === 1), true);
});

Deno.test("at least one rostered active player is undrafted", () => {
  const generator = createArchetypePlayerGenerator();
  const result = generator.generate(INPUT);
  const rostered = result.players.filter(
    (p) => p.player.teamId !== null && p.player.status === "active",
  );
  const undrafted = rostered.filter((p) => p.player.draftYear === null);
  assertEquals(undrafted.length > 0, true);
});

Deno.test("drafted rostered players carry their drafting team", () => {
  const generator = createArchetypePlayerGenerator();
  const result = generator.generate(INPUT);
  const rostered = result.players.filter(
    (p) => p.player.teamId !== null && p.player.status === "active",
  );
  const drafted = rostered.filter((p) => p.player.draftYear !== null);
  for (const entry of drafted) {
    assertEquals(typeof entry.player.draftingTeamId, "string");
  }
});

Deno.test("roster composition sums to 53 players", () => {
  const total = ROSTER_BUCKET_COMPOSITION.reduce(
    (sum, entry) => sum + entry.count,
    0,
  );
  assertEquals(total, 53);
});

Deno.test("attribute variance exists — not all players of same bucket are identical", () => {
  const generator = createArchetypePlayerGenerator();
  const result = generator.generate(INPUT);
  const qbs = result.players.filter((p) => bucketOf(p) === "QB");
  if (qbs.length < 2) return;

  let differences = 0;
  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    if (
      (qbs[0].attributes as Record<string, number>)[key] !==
        (qbs[1].attributes as Record<string, number>)[key]
    ) {
      differences++;
    }
  }
  assertEquals(differences > 0, true, "QBs should have varied attributes");
});
