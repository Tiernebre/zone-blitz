import type {
  PlayerAttributeKey,
  PlayerAttributes,
} from "../types/player-attributes.ts";

export const NEUTRAL_BUCKETS = [
  "QB",
  "RB",
  "WR",
  "TE",
  "OT",
  "IOL",
  "EDGE",
  "IDL",
  "LB",
  "CB",
  "S",
  "K",
  "P",
  "LS",
] as const;

export type NeutralBucket = typeof NEUTRAL_BUCKETS[number];

export interface NeutralBucketInput {
  attributes: PlayerAttributes;
  heightInches: number;
  weightPounds: number;
}

interface BucketRule {
  bucket: NeutralBucket;
  signature: readonly PlayerAttributeKey[];
  qualifies: (input: NeutralBucketInput) => boolean;
}

// Tie-break priority per ADR 0006 — specialists first, then position-specific
// in fixed order so classification is deterministic when two signatures score
// equally.
const PRIORITY_ORDER: readonly NeutralBucket[] = [
  "LS",
  "K",
  "P",
  "QB",
  "TE",
  "EDGE",
  "IDL",
  "OT",
  "IOL",
  "RB",
  "WR",
  "LB",
  "S",
  "CB",
] as const;

const BUCKET_RULES: readonly BucketRule[] = [
  {
    bucket: "LS",
    signature: ["snapAccuracy"],
    qualifies: ({ attributes }) => attributes.snapAccuracy >= 60,
  },
  {
    bucket: "K",
    signature: ["kickingPower", "kickingAccuracy"],
    qualifies: ({ attributes }) =>
      attributes.kickingPower >= 40 && attributes.kickingAccuracy >= 40,
  },
  {
    bucket: "P",
    signature: ["puntingPower", "puntingAccuracy"],
    qualifies: ({ attributes }) =>
      attributes.puntingPower >= 40 && attributes.puntingAccuracy >= 40,
  },
  {
    bucket: "QB",
    signature: [
      "armStrength",
      "accuracyShort",
      "accuracyMedium",
      "accuracyDeep",
      "release",
      "decisionMaking",
    ],
    qualifies: () => true,
  },
  {
    bucket: "TE",
    signature: ["catching", "runBlocking", "passBlocking"],
    qualifies: ({ heightInches, weightPounds }) =>
      heightInches >= 74 && weightPounds >= 225 && weightPounds <= 285,
  },
  {
    bucket: "EDGE",
    signature: ["passRushing", "acceleration", "blockShedding", "speed"],
    qualifies: ({ weightPounds }) => weightPounds >= 230 && weightPounds <= 290,
  },
  {
    bucket: "IDL",
    signature: ["strength", "blockShedding", "runDefense", "passRushing"],
    qualifies: ({ weightPounds }) => weightPounds >= 280,
  },
  {
    bucket: "OT",
    signature: ["passBlocking", "runBlocking", "agility"],
    qualifies: ({ heightInches, weightPounds }) =>
      heightInches >= 76 && weightPounds >= 290,
  },
  {
    bucket: "IOL",
    signature: ["runBlocking", "passBlocking", "strength"],
    qualifies: ({ weightPounds }) => weightPounds >= 290,
  },
  {
    bucket: "RB",
    signature: ["ballCarrying", "elusiveness", "acceleration", "speed"],
    qualifies: ({ weightPounds }) => weightPounds >= 180 && weightPounds <= 250,
  },
  {
    bucket: "WR",
    signature: ["routeRunning", "catching", "speed", "acceleration"],
    qualifies: ({ weightPounds }) => weightPounds >= 160 && weightPounds <= 230,
  },
  {
    bucket: "LB",
    signature: ["tackling", "runDefense", "zoneCoverage", "footballIq"],
    qualifies: ({ weightPounds }) => weightPounds >= 210 && weightPounds <= 265,
  },
  {
    bucket: "S",
    signature: ["zoneCoverage", "tackling", "footballIq", "anticipation"],
    qualifies: ({ weightPounds }) => weightPounds >= 175 && weightPounds <= 235,
  },
  {
    bucket: "CB",
    signature: ["manCoverage", "zoneCoverage", "speed", "agility"],
    qualifies: ({ weightPounds }) => weightPounds >= 160 && weightPounds <= 220,
  },
];

function signatureScore(
  attributes: PlayerAttributes,
  signature: readonly PlayerAttributeKey[],
): number {
  let sum = 0;
  for (const key of signature) {
    sum += attributes[key];
  }
  return sum / signature.length;
}

export function neutralBucket(input: NeutralBucketInput): NeutralBucket {
  const eligible = BUCKET_RULES
    .filter((rule) => rule.qualifies(input))
    .map((rule) => ({
      bucket: rule.bucket,
      score: signatureScore(input.attributes, rule.signature),
    }));

  let winner = eligible[0];
  for (const candidate of eligible.slice(1)) {
    if (candidate.score > winner.score) {
      winner = candidate;
      continue;
    }
    if (candidate.score === winner.score) {
      const candidateRank = PRIORITY_ORDER.indexOf(candidate.bucket);
      const winnerRank = PRIORITY_ORDER.indexOf(winner.bucket);
      if (candidateRank < winnerRank) {
        winner = candidate;
      }
    }
  }
  return winner.bucket;
}
