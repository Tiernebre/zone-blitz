import {
  archetypesForBucket,
  NEUTRAL_BUCKETS,
  type NeutralBucket,
  PLAYER_ATTRIBUTE_KEYS,
  type PlayerArchetype,
  type PlayerAttributeKey,
  type PlayerAttributes,
} from "@zone-blitz/shared";
import type {
  ContractGeneratorInput,
  GeneratedContract,
  GeneratedPlayers,
  PlayersGenerator,
  PlayersGeneratorInput,
} from "./players.generator.interface.ts";
import { createSeededRng, hashSeed, type SeededRng } from "./seeded-rng.ts";
import { ROSTER_BUCKET_COMPOSITION } from "./stub-players-generator.ts";

export interface ArchetypeGeneratorConfig {
  crossArchetypeRate: number;
}

const DEFAULT_CONFIG: ArchetypeGeneratorConfig = {
  crossArchetypeRate: 0.02,
};

const ROSTER_BUCKET_SLOTS: readonly NeutralBucket[] = ROSTER_BUCKET_COMPOSITION
  .flatMap(({ bucket, count }) => Array.from({ length: count }, () => bucket));

const FREE_AGENT_BUCKET_CYCLE: readonly NeutralBucket[] = [...NEUTRAL_BUCKETS];
const FREE_AGENT_COUNT = 50;
const DRAFT_PROSPECT_COUNT = 250;

const PRIMARY_BOOST = 20;
const SECONDARY_BOOST = 10;

const TIER_RANGES: readonly { weight: number; min: number; max: number }[] = [
  { weight: 5, min: 15, max: 24 },
  { weight: 25, min: 25, max: 39 },
  { weight: 35, min: 35, max: 49 },
  { weight: 20, min: 45, max: 59 },
  { weight: 10, min: 55, max: 69 },
  { weight: 4, min: 65, max: 79 },
  { weight: 0.9, min: 78, max: 89 },
  { weight: 0.1, min: 88, max: 96 },
];

const TOTAL_TIER_WEIGHT = TIER_RANGES.reduce((s, t) => s + t.weight, 0);

const CROSS_ARCHETYPE_PAIRS: readonly [NeutralBucket, NeutralBucket][] = [
  ["CB", "WR"],
  ["S", "LB"],
  ["TE", "EDGE"],
  ["RB", "LB"],
  ["WR", "RB"],
];

const FIRST_NAMES = [
  "James",
  "John",
  "Robert",
  "Michael",
  "William",
  "David",
  "Richard",
  "Joseph",
  "Thomas",
  "Charles",
  "Daniel",
  "Matthew",
  "Anthony",
  "Mark",
  "Donald",
  "Steven",
  "Paul",
  "Andrew",
  "Joshua",
  "Kenneth",
  "Kevin",
  "Brian",
  "George",
  "Timothy",
  "Ronald",
  "Edward",
  "Jason",
  "Jeffrey",
  "Ryan",
  "Jacob",
  "Gary",
  "Nicholas",
  "Eric",
  "Jonathan",
  "Stephen",
  "Larry",
  "Justin",
  "Scott",
  "Brandon",
  "Benjamin",
  "Samuel",
  "Raymond",
  "Gregory",
  "Frank",
  "Alexander",
  "Patrick",
  "Jack",
  "Dennis",
  "Jerry",
  "Tyler",
  "Aaron",
  "Jose",
  "Adam",
  "Nathan",
  "Henry",
  "Douglas",
  "Peter",
  "Zachary",
  "Kyle",
] as const;

const LAST_NAMES = [
  "Smith",
  "Johnson",
  "Williams",
  "Brown",
  "Jones",
  "Garcia",
  "Miller",
  "Davis",
  "Rodriguez",
  "Martinez",
  "Hernandez",
  "Lopez",
  "Gonzalez",
  "Wilson",
  "Anderson",
  "Thomas",
  "Taylor",
  "Moore",
  "Jackson",
  "Martin",
  "Lee",
  "Perez",
  "Thompson",
  "White",
  "Harris",
  "Sanchez",
  "Clark",
  "Ramirez",
  "Lewis",
  "Robinson",
  "Walker",
  "Young",
  "Allen",
  "King",
  "Wright",
  "Scott",
  "Torres",
  "Nguyen",
  "Hill",
  "Flores",
  "Green",
  "Adams",
  "Nelson",
  "Baker",
  "Hall",
  "Rivera",
  "Campbell",
  "Mitchell",
  "Carter",
  "Roberts",
  "Phillips",
  "Evans",
  "Turner",
  "Parker",
  "Collins",
  "Edwards",
  "Stewart",
  "Morris",
  "Murphy",
] as const;

const STUB_HOMETOWNS = [
  "Houston, TX",
  "Miami, FL",
  "Atlanta, GA",
  "Chicago, IL",
  "Los Angeles, CA",
  "Philadelphia, PA",
  "Dallas, TX",
  "Detroit, MI",
] as const;

const COLLEGES = [
  "State University",
  "Alabama",
  "Ohio State",
  "Georgia",
  "LSU",
  "Clemson",
  "Michigan",
  "Notre Dame",
  "Texas",
  "Oregon",
  "Penn State",
  "USC",
  "Oklahoma",
  "Florida",
  "Auburn",
  "Tennessee",
  "Wisconsin",
  "Iowa",
  "Stanford",
  "Virginia Tech",
] as const;

function pickTier(rng: SeededRng): { min: number; max: number } {
  let roll = rng.nextFloat(0, TOTAL_TIER_WEIGHT);
  for (const tier of TIER_RANGES) {
    roll -= tier.weight;
    if (roll <= 0) return tier;
  }
  return TIER_RANGES[TIER_RANGES.length - 1];
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function rollAttributes(
  rng: SeededRng,
  archetype: PlayerArchetype,
  secondaryArchetype: PlayerArchetype | null,
): PlayerAttributes {
  const tier = pickTier(rng);
  const baseline = rng.nextInt(tier.min, tier.max);
  const primarySet = new Set<PlayerAttributeKey>(archetype.primaryAttributes);
  const secondarySet = new Set<PlayerAttributeKey>(
    archetype.secondaryAttributes,
  );

  if (secondaryArchetype) {
    for (const attr of secondaryArchetype.primaryAttributes) {
      primarySet.add(attr);
    }
    for (const attr of secondaryArchetype.secondaryAttributes) {
      if (!primarySet.has(attr)) secondarySet.add(attr);
    }
  }

  const attrs: Record<string, number> = {};
  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    const noise = rng.nextInt(-5, 5);
    let value: number;
    if (primarySet.has(key)) {
      value = baseline + PRIMARY_BOOST + noise;
    } else if (secondarySet.has(key)) {
      value = baseline + SECONDARY_BOOST + noise;
    } else {
      value = Math.max(1, baseline - 10 + noise);
    }
    attrs[key] = clamp(value);

    const potentialHeadroom = rng.nextInt(3, 15);
    attrs[`${key}Potential`] = clamp(attrs[key] + potentialHeadroom);
  }

  return attrs as PlayerAttributes;
}

function rollSize(
  rng: SeededRng,
  archetype: PlayerArchetype,
  secondary: PlayerArchetype | null,
): { heightInches: number; weightPounds: number } {
  const hMin = secondary
    ? Math.min(archetype.heightRange[0], secondary.heightRange[0])
    : archetype.heightRange[0];
  const hMax = secondary
    ? Math.max(archetype.heightRange[1], secondary.heightRange[1])
    : archetype.heightRange[1];
  const wMin = secondary
    ? Math.min(archetype.weightRange[0], secondary.weightRange[0])
    : archetype.weightRange[0];
  const wMax = secondary
    ? Math.max(archetype.weightRange[1], secondary.weightRange[1])
    : archetype.weightRange[1];

  return {
    heightInches: rng.nextInt(hMin, hMax),
    weightPounds: rng.nextInt(wMin, wMax),
  };
}

function generatePlayer(
  rng: SeededRng,
  bucket: NeutralBucket,
  config: ArchetypeGeneratorConfig,
  leagueId: string,
  teamId: string | null,
  status: "active" | "prospect",
  nameIndex: number,
  draftingTeamId: string | null,
) {
  const archetypes = archetypesForBucket(bucket);
  const primary = rng.pick(archetypes);

  let secondary: PlayerArchetype | null = null;
  if (rng.next() < config.crossArchetypeRate) {
    const pair = CROSS_ARCHETYPE_PAIRS.find(
      ([a, b]) => a === bucket || b === bucket,
    );
    if (pair) {
      const otherBucket = pair[0] === bucket ? pair[1] : pair[0];
      const otherArchetypes = archetypesForBucket(otherBucket);
      if (otherArchetypes.length > 0) {
        secondary = rng.pick(otherArchetypes);
      }
    }
  }

  const { heightInches, weightPounds } = rollSize(rng, primary, secondary);
  const attributes = rollAttributes(rng, primary, secondary);

  const { firstName, lastName } = randomName(nameIndex);
  const origin = playerOrigin(rng, nameIndex, draftingTeamId, status);

  return {
    player: {
      leagueId,
      teamId,
      status,
      firstName,
      lastName,
      injuryStatus: "healthy" as const,
      heightInches,
      weightPounds,
      college: rng.pick(COLLEGES),
      birthDate: `${rng.nextInt(1995, 2005)}-${
        String(rng.nextInt(1, 12)).padStart(2, "0")
      }-${String(rng.nextInt(1, 28)).padStart(2, "0")}`,
      ...origin,
    },
    attributes,
  };
}

function randomName(index: number) {
  const firstName = FIRST_NAMES[index % FIRST_NAMES.length];
  const lastName =
    LAST_NAMES[Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length];
  return { firstName, lastName };
}

function playerOrigin(
  rng: SeededRng,
  index: number,
  draftingTeamId: string | null,
  status: "active" | "prospect",
) {
  if (status === "prospect") {
    return {
      hometown: STUB_HOMETOWNS[index % STUB_HOMETOWNS.length],
      draftYear: null,
      draftRound: null,
      draftPick: null,
      draftingTeamId: null,
    };
  }

  const undrafted = index % 17 === 0;
  if (undrafted) {
    return {
      hometown: STUB_HOMETOWNS[index % STUB_HOMETOWNS.length],
      draftYear: null,
      draftRound: null,
      draftPick: null,
      draftingTeamId: null,
    };
  }

  const round = (index % 7) + 1;
  const pickInRound = (index % 32) + 1;
  const overallPick = (round - 1) * 32 + pickInRound;
  return {
    hometown: rng.pick(STUB_HOMETOWNS),
    draftYear: rng.nextInt(2020, 2025),
    draftRound: round,
    draftPick: overallPick,
    draftingTeamId,
  };
}

export function createArchetypePlayerGenerator(
  config: ArchetypeGeneratorConfig = DEFAULT_CONFIG,
): PlayersGenerator {
  return {
    generate(input: PlayersGeneratorInput): GeneratedPlayers {
      const rng = createSeededRng(hashSeed(input.leagueId));
      let nameIndex = 0;
      const players = [];

      for (const teamId of input.teamIds) {
        for (let i = 0; i < input.rosterSize; i++) {
          const bucket = ROSTER_BUCKET_SLOTS[i % ROSTER_BUCKET_SLOTS.length];
          players.push(
            generatePlayer(
              rng,
              bucket,
              config,
              input.leagueId,
              teamId,
              "active",
              nameIndex,
              teamId,
            ),
          );
          nameIndex++;
        }
      }

      for (let i = 0; i < FREE_AGENT_COUNT; i++) {
        const bucket =
          FREE_AGENT_BUCKET_CYCLE[i % FREE_AGENT_BUCKET_CYCLE.length];
        players.push(
          generatePlayer(
            rng,
            bucket,
            config,
            input.leagueId,
            null,
            "active",
            nameIndex,
            null,
          ),
        );
        nameIndex++;
      }

      for (let i = 0; i < DRAFT_PROSPECT_COUNT; i++) {
        const bucket =
          FREE_AGENT_BUCKET_CYCLE[i % FREE_AGENT_BUCKET_CYCLE.length];
        players.push(
          generatePlayer(
            rng,
            bucket,
            config,
            input.leagueId,
            null,
            "prospect",
            nameIndex,
            null,
          ),
        );
        nameIndex++;
      }

      return { players };
    },

    generateContracts(input: ContractGeneratorInput): GeneratedContract[] {
      const rosteredPlayers = input.players.filter((p) => p.teamId !== null);
      const perPlayerSalary = Math.floor(
        input.salaryCap / Math.max(rosteredPlayers.length, 1),
      );

      return rosteredPlayers.map((player) => ({
        playerId: player.id,
        teamId: player.teamId!,
        totalYears: 3,
        currentYear: 1,
        totalSalary: perPlayerSalary * 3,
        annualSalary: perPlayerSalary,
        guaranteedMoney: perPlayerSalary,
        signingBonus: 0,
      }));
    },
  };
}
