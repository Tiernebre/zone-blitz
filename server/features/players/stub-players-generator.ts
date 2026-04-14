import {
  NEUTRAL_BUCKETS,
  type NeutralBucket,
  PLAYER_ATTRIBUTE_KEYS,
  type PlayerAttributeKey,
  type PlayerAttributes,
} from "@zone-blitz/shared";
import {
  createNameGenerator,
  type NameGenerator,
} from "../../shared/name-generator.ts";
import type {
  ContractGeneratorInput,
  GeneratedContract,
  GeneratedPlayers,
  PlayersGenerator,
  PlayersGeneratorInput,
} from "./players.generator.interface.ts";

const STUB_BASELINE = 30;
const STUB_POTENTIAL = 60;
const STUB_COLLEGE = "State University";
const STUB_BIRTH_DATE = "2000-01-01";
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

// Attribute profiles per neutral bucket. Each profile lifts the bucket's
// signature attributes above baseline and picks a size within the bucket's
// gate so neutralBucket() deterministically classifies the generated player
// into the intended bucket. Preview of the archetype-aware generator flagged
// by ADR 0006 — a richer distribution comes with the real generator.
export interface BucketProfile {
  heightInches: number;
  weightPounds: number;
  overrides: Partial<Record<PlayerAttributeKey, number>>;
}

export const BUCKET_PROFILES: Record<NeutralBucket, BucketProfile> = {
  QB: {
    heightInches: 75,
    weightPounds: 225,
    overrides: {
      armStrength: 55,
      accuracyShort: 55,
      accuracyMedium: 55,
      accuracyDeep: 55,
      release: 55,
      decisionMaking: 55,
    },
  },
  RB: {
    heightInches: 71,
    weightPounds: 215,
    overrides: {
      ballCarrying: 55,
      elusiveness: 55,
      acceleration: 55,
      speed: 55,
    },
  },
  WR: {
    heightInches: 73,
    weightPounds: 200,
    overrides: {
      routeRunning: 55,
      catching: 55,
      speed: 55,
      acceleration: 55,
    },
  },
  TE: {
    heightInches: 77,
    weightPounds: 250,
    overrides: {
      catching: 55,
      runBlocking: 55,
      passBlocking: 55,
    },
  },
  OT: {
    heightInches: 78,
    weightPounds: 310,
    overrides: {
      passBlocking: 55,
      runBlocking: 55,
      agility: 50,
    },
  },
  IOL: {
    heightInches: 74,
    weightPounds: 310,
    overrides: {
      runBlocking: 55,
      passBlocking: 55,
      strength: 55,
    },
  },
  EDGE: {
    heightInches: 76,
    weightPounds: 260,
    overrides: {
      passRushing: 55,
      acceleration: 55,
      blockShedding: 55,
      speed: 50,
    },
  },
  IDL: {
    heightInches: 74,
    weightPounds: 305,
    overrides: {
      strength: 55,
      blockShedding: 55,
      runDefense: 55,
      passRushing: 50,
    },
  },
  LB: {
    heightInches: 73,
    weightPounds: 235,
    overrides: {
      tackling: 55,
      runDefense: 55,
      zoneCoverage: 50,
      footballIq: 55,
    },
  },
  CB: {
    heightInches: 72,
    weightPounds: 195,
    overrides: {
      manCoverage: 55,
      zoneCoverage: 55,
      speed: 55,
      agility: 55,
    },
  },
  S: {
    heightInches: 73,
    weightPounds: 210,
    overrides: {
      zoneCoverage: 55,
      tackling: 55,
      footballIq: 55,
      anticipation: 55,
    },
  },
  K: {
    heightInches: 71,
    weightPounds: 195,
    overrides: {
      kickingPower: 70,
      kickingAccuracy: 70,
    },
  },
  P: {
    heightInches: 72,
    weightPounds: 210,
    overrides: {
      puntingPower: 70,
      puntingAccuracy: 70,
    },
  },
  LS: {
    heightInches: 73,
    weightPounds: 240,
    overrides: {
      snapAccuracy: 75,
    },
  },
};

// Target roster composition by neutral bucket. FB is intentionally absent —
// lead-blocking fullbacks classify as RB under the neutral lens (ADR 0006).
export const ROSTER_BUCKET_COMPOSITION: readonly {
  bucket: NeutralBucket;
  count: number;
}[] = [
  { bucket: "QB", count: 2 },
  { bucket: "RB", count: 4 },
  { bucket: "WR", count: 6 },
  { bucket: "TE", count: 3 },
  { bucket: "OT", count: 4 },
  { bucket: "IOL", count: 5 },
  { bucket: "EDGE", count: 4 },
  { bucket: "IDL", count: 4 },
  { bucket: "LB", count: 7 },
  { bucket: "CB", count: 6 },
  { bucket: "S", count: 5 },
  { bucket: "K", count: 1 },
  { bucket: "P", count: 1 },
  { bucket: "LS", count: 1 },
];

const ROSTER_BUCKET_SLOTS: readonly NeutralBucket[] = ROSTER_BUCKET_COMPOSITION
  .flatMap(({ bucket, count }) => Array.from({ length: count }, () => bucket));

const FREE_AGENT_BUCKET_CYCLE: readonly NeutralBucket[] = [...NEUTRAL_BUCKETS];

export function stubAttributesFor(bucket: NeutralBucket): PlayerAttributes {
  const profile = BUCKET_PROFILES[bucket];
  const attrs: Record<string, number> = {};
  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    attrs[key] = profile.overrides[key] ?? STUB_BASELINE;
    attrs[`${key}Potential`] = Math.max(
      STUB_POTENTIAL,
      profile.overrides[key] ?? STUB_BASELINE,
    );
  }
  return attrs as PlayerAttributes;
}

const FREE_AGENT_COUNT = 50;
const DRAFT_PROSPECT_COUNT = 250;

function stubOrigin(index: number, draftingTeamId: string | null) {
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
    hometown: STUB_HOMETOWNS[index % STUB_HOMETOWNS.length],
    draftYear: 2020 + (index % 6),
    draftRound: round,
    draftPick: overallPick,
    draftingTeamId,
  };
}

function playerShell(
  bucket: NeutralBucket,
  overrides: {
    leagueId: string;
    teamId: string | null;
    status: "active" | "prospect";
    firstName: string;
    lastName: string;
    origin: ReturnType<typeof stubOrigin>;
  },
) {
  const profile = BUCKET_PROFILES[bucket];
  return {
    leagueId: overrides.leagueId,
    teamId: overrides.teamId,
    status: overrides.status,
    firstName: overrides.firstName,
    lastName: overrides.lastName,
    injuryStatus: "healthy" as const,
    heightInches: profile.heightInches,
    weightPounds: profile.weightPounds,
    college: STUB_COLLEGE,
    birthDate: STUB_BIRTH_DATE,
    ...overrides.origin,
  };
}

export interface StubPlayersGeneratorOptions {
  nameGenerator?: NameGenerator;
}

export function createStubPlayersGenerator(
  options: StubPlayersGeneratorOptions = {},
): PlayersGenerator {
  const nameGenerator = options.nameGenerator ?? createNameGenerator();
  return {
    generate(input: PlayersGeneratorInput): GeneratedPlayers {
      let nameIndex = 0;

      const players = [];
      for (const teamId of input.teamIds) {
        for (let i = 0; i < input.rosterSize; i++) {
          const { firstName, lastName } = nameGenerator.next();
          nameIndex++;
          const bucket = ROSTER_BUCKET_SLOTS[i % ROSTER_BUCKET_SLOTS.length];
          const origin = stubOrigin(nameIndex, teamId);
          players.push({
            player: playerShell(bucket, {
              leagueId: input.leagueId,
              teamId,
              status: "active",
              firstName,
              lastName,
              origin,
            }),
            attributes: stubAttributesFor(bucket),
          });
        }
      }

      for (let i = 0; i < FREE_AGENT_COUNT; i++) {
        const { firstName, lastName } = nameGenerator.next();
        nameIndex++;
        const bucket = FREE_AGENT_BUCKET_CYCLE[
          i % FREE_AGENT_BUCKET_CYCLE.length
        ];
        const origin = stubOrigin(nameIndex, null);
        players.push({
          player: playerShell(bucket, {
            leagueId: input.leagueId,
            teamId: null,
            status: "active",
            firstName,
            lastName,
            origin,
          }),
          attributes: stubAttributesFor(bucket),
        });
      }

      for (let i = 0; i < DRAFT_PROSPECT_COUNT; i++) {
        const { firstName, lastName } = nameGenerator.next();
        nameIndex++;
        const bucket = FREE_AGENT_BUCKET_CYCLE[
          i % FREE_AGENT_BUCKET_CYCLE.length
        ];
        players.push({
          player: playerShell(bucket, {
            leagueId: input.leagueId,
            teamId: null,
            status: "prospect",
            firstName,
            lastName,
            origin: {
              hometown: STUB_HOMETOWNS[i % STUB_HOMETOWNS.length],
              draftYear: null,
              draftRound: null,
              draftPick: null,
              draftingTeamId: null,
            },
          }),
          attributes: stubAttributesFor(bucket),
        });
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
