import type { NeutralBucket } from "./neutral-bucket.ts";
import type { PlayerAttributeKey } from "../types/player-attributes.ts";

export interface PlayerArchetype {
  readonly name: string;
  readonly bucket: NeutralBucket;
  readonly primaryAttributes: readonly PlayerAttributeKey[];
  readonly secondaryAttributes: readonly PlayerAttributeKey[];
  readonly heightRange: readonly [min: number, max: number];
  readonly weightRange: readonly [min: number, max: number];
}

export const PLAYER_ARCHETYPES: readonly PlayerArchetype[] = [
  // --- QB ---
  {
    name: "gun-slinger",
    bucket: "QB",
    primaryAttributes: [
      "armStrength",
      "accuracyDeep",
      "release",
      "composure",
    ],
    secondaryAttributes: [
      "accuracyMedium",
      "touch",
      "decisionMaking",
      "clutch",
    ],
    heightRange: [73, 78],
    weightRange: [210, 240],
  },
  {
    name: "pocket-passer",
    bucket: "QB",
    primaryAttributes: [
      "accuracyShort",
      "accuracyMedium",
      "decisionMaking",
      "footballIq",
    ],
    secondaryAttributes: [
      "touch",
      "release",
      "composure",
      "anticipation",
    ],
    heightRange: [74, 78],
    weightRange: [210, 240],
  },
  {
    name: "dual-threat",
    bucket: "QB",
    primaryAttributes: [
      "speed",
      "acceleration",
      "accuracyOnTheRun",
      "elusiveness",
    ],
    secondaryAttributes: [
      "armStrength",
      "accuracyShort",
      "agility",
      "decisionMaking",
    ],
    heightRange: [72, 76],
    weightRange: [200, 230],
  },

  // --- RB ---
  {
    name: "power-back",
    bucket: "RB",
    primaryAttributes: ["strength", "ballCarrying", "durability", "stamina"],
    secondaryAttributes: [
      "acceleration",
      "elusiveness",
      "runBlocking",
      "runAfterCatch",
    ],
    heightRange: [69, 73],
    weightRange: [215, 250],
  },
  {
    name: "speed-back",
    bucket: "RB",
    primaryAttributes: ["speed", "acceleration", "elusiveness", "agility"],
    secondaryAttributes: [
      "ballCarrying",
      "routeRunning",
      "catching",
      "runAfterCatch",
    ],
    heightRange: [67, 72],
    weightRange: [185, 215],
  },
  {
    name: "receiving-back",
    bucket: "RB",
    primaryAttributes: [
      "catching",
      "routeRunning",
      "elusiveness",
      "runAfterCatch",
    ],
    secondaryAttributes: [
      "speed",
      "acceleration",
      "ballCarrying",
      "agility",
    ],
    heightRange: [68, 72],
    weightRange: [190, 220],
  },

  // --- WR ---
  {
    name: "deep-threat",
    bucket: "WR",
    primaryAttributes: ["speed", "acceleration", "catching", "jumping"],
    secondaryAttributes: [
      "routeRunning",
      "contestedCatching",
      "runAfterCatch",
      "agility",
    ],
    heightRange: [69, 74],
    weightRange: [170, 200],
  },
  {
    name: "possession-receiver",
    bucket: "WR",
    primaryAttributes: [
      "routeRunning",
      "catching",
      "footballIq",
      "consistency",
    ],
    secondaryAttributes: [
      "contestedCatching",
      "runAfterCatch",
      "composure",
      "agility",
    ],
    heightRange: [70, 75],
    weightRange: [185, 215],
  },
  {
    name: "contested-catch-specialist",
    bucket: "WR",
    primaryAttributes: [
      "contestedCatching",
      "catching",
      "jumping",
      "strength",
    ],
    secondaryAttributes: [
      "routeRunning",
      "speed",
      "runAfterCatch",
      "durability",
    ],
    heightRange: [73, 78],
    weightRange: [205, 230],
  },

  // --- TE ---
  {
    name: "receiving-te",
    bucket: "TE",
    primaryAttributes: [
      "catching",
      "routeRunning",
      "speed",
      "contestedCatching",
    ],
    secondaryAttributes: [
      "runAfterCatch",
      "acceleration",
      "agility",
      "passBlocking",
    ],
    heightRange: [75, 78],
    weightRange: [230, 260],
  },
  {
    name: "blocking-te",
    bucket: "TE",
    primaryAttributes: [
      "runBlocking",
      "passBlocking",
      "strength",
      "durability",
    ],
    secondaryAttributes: [
      "catching",
      "footballIq",
      "composure",
      "stamina",
    ],
    heightRange: [75, 78],
    weightRange: [250, 275],
  },
  {
    name: "move-te",
    bucket: "TE",
    primaryAttributes: [
      "catching",
      "runBlocking",
      "speed",
      "passBlocking",
    ],
    secondaryAttributes: [
      "routeRunning",
      "contestedCatching",
      "acceleration",
      "footballIq",
    ],
    heightRange: [76, 79],
    weightRange: [240, 270],
  },

  // --- OT ---
  {
    name: "pass-protector",
    bucket: "OT",
    primaryAttributes: [
      "passBlocking",
      "agility",
      "composure",
      "footballIq",
    ],
    secondaryAttributes: [
      "runBlocking",
      "strength",
      "durability",
      "stamina",
    ],
    heightRange: [77, 80],
    weightRange: [300, 330],
  },
  {
    name: "road-grader-tackle",
    bucket: "OT",
    primaryAttributes: [
      "runBlocking",
      "strength",
      "durability",
      "stamina",
    ],
    secondaryAttributes: [
      "passBlocking",
      "agility",
      "composure",
      "footballIq",
    ],
    heightRange: [77, 80],
    weightRange: [310, 340],
  },

  // --- IOL ---
  {
    name: "zone-blocking-guard",
    bucket: "IOL",
    primaryAttributes: ["agility", "footballIq", "runBlocking", "acceleration"],
    secondaryAttributes: [
      "passBlocking",
      "speed",
      "composure",
      "stamina",
    ],
    heightRange: [73, 77],
    weightRange: [295, 325],
  },
  {
    name: "power-guard",
    bucket: "IOL",
    primaryAttributes: [
      "strength",
      "runBlocking",
      "passBlocking",
      "durability",
    ],
    secondaryAttributes: [
      "footballIq",
      "composure",
      "stamina",
      "agility",
    ],
    heightRange: [73, 77],
    weightRange: [305, 340],
  },
  {
    name: "anchor-center",
    bucket: "IOL",
    primaryAttributes: [
      "footballIq",
      "passBlocking",
      "strength",
      "composure",
    ],
    secondaryAttributes: [
      "runBlocking",
      "leadership",
      "durability",
      "stamina",
    ],
    heightRange: [73, 76],
    weightRange: [295, 320],
  },

  // --- EDGE ---
  {
    name: "speed-rusher",
    bucket: "EDGE",
    primaryAttributes: [
      "speed",
      "acceleration",
      "passRushing",
      "agility",
    ],
    secondaryAttributes: [
      "blockShedding",
      "stamina",
      "composure",
      "elusiveness",
    ],
    heightRange: [74, 78],
    weightRange: [235, 270],
  },
  {
    name: "power-rusher",
    bucket: "EDGE",
    primaryAttributes: [
      "strength",
      "passRushing",
      "blockShedding",
      "durability",
    ],
    secondaryAttributes: [
      "acceleration",
      "runDefense",
      "stamina",
      "composure",
    ],
    heightRange: [75, 79],
    weightRange: [255, 290],
  },
  {
    name: "edge-setter",
    bucket: "EDGE",
    primaryAttributes: [
      "runDefense",
      "blockShedding",
      "strength",
      "tackling",
    ],
    secondaryAttributes: [
      "passRushing",
      "durability",
      "footballIq",
      "stamina",
    ],
    heightRange: [75, 78],
    weightRange: [250, 285],
  },

  // --- IDL ---
  {
    name: "nose-tackle",
    bucket: "IDL",
    primaryAttributes: [
      "strength",
      "runDefense",
      "durability",
      "stamina",
    ],
    secondaryAttributes: [
      "blockShedding",
      "passRushing",
      "composure",
      "footballIq",
    ],
    heightRange: [72, 76],
    weightRange: [310, 350],
  },
  {
    name: "three-technique",
    bucket: "IDL",
    primaryAttributes: [
      "passRushing",
      "acceleration",
      "blockShedding",
      "agility",
    ],
    secondaryAttributes: [
      "strength",
      "speed",
      "runDefense",
      "stamina",
    ],
    heightRange: [73, 77],
    weightRange: [280, 320],
  },

  // --- LB ---
  {
    name: "thumper-lb",
    bucket: "LB",
    primaryAttributes: [
      "tackling",
      "runDefense",
      "strength",
      "durability",
    ],
    secondaryAttributes: [
      "footballIq",
      "blockShedding",
      "stamina",
      "composure",
    ],
    heightRange: [72, 75],
    weightRange: [230, 260],
  },
  {
    name: "coverage-lb",
    bucket: "LB",
    primaryAttributes: [
      "zoneCoverage",
      "speed",
      "footballIq",
      "anticipation",
    ],
    secondaryAttributes: [
      "tackling",
      "agility",
      "manCoverage",
      "acceleration",
    ],
    heightRange: [72, 75],
    weightRange: [220, 250],
  },
  {
    name: "all-around-lb",
    bucket: "LB",
    primaryAttributes: [
      "tackling",
      "footballIq",
      "zoneCoverage",
      "runDefense",
    ],
    secondaryAttributes: [
      "speed",
      "anticipation",
      "composure",
      "durability",
    ],
    heightRange: [72, 76],
    weightRange: [225, 255],
  },

  // --- CB ---
  {
    name: "press-man-cb",
    bucket: "CB",
    primaryAttributes: [
      "manCoverage",
      "speed",
      "agility",
      "strength",
    ],
    secondaryAttributes: [
      "jumping",
      "acceleration",
      "composure",
      "anticipation",
    ],
    heightRange: [71, 75],
    weightRange: [185, 215],
  },
  {
    name: "zone-cb",
    bucket: "CB",
    primaryAttributes: [
      "zoneCoverage",
      "anticipation",
      "footballIq",
      "speed",
    ],
    secondaryAttributes: [
      "agility",
      "catching",
      "manCoverage",
      "composure",
    ],
    heightRange: [70, 74],
    weightRange: [180, 210],
  },
  {
    name: "slot-cb",
    bucket: "CB",
    primaryAttributes: [
      "agility",
      "manCoverage",
      "zoneCoverage",
      "acceleration",
    ],
    secondaryAttributes: [
      "speed",
      "tackling",
      "footballIq",
      "anticipation",
    ],
    heightRange: [69, 73],
    weightRange: [175, 205],
  },

  // --- S ---
  {
    name: "free-safety",
    bucket: "S",
    primaryAttributes: [
      "zoneCoverage",
      "speed",
      "anticipation",
      "catching",
    ],
    secondaryAttributes: [
      "footballIq",
      "agility",
      "acceleration",
      "composure",
    ],
    heightRange: [70, 74],
    weightRange: [190, 215],
  },
  {
    name: "box-safety",
    bucket: "S",
    primaryAttributes: [
      "tackling",
      "runDefense",
      "strength",
      "footballIq",
    ],
    secondaryAttributes: [
      "zoneCoverage",
      "speed",
      "anticipation",
      "durability",
    ],
    heightRange: [71, 75],
    weightRange: [200, 225],
  },
  {
    name: "hybrid-safety",
    bucket: "S",
    primaryAttributes: [
      "zoneCoverage",
      "tackling",
      "footballIq",
      "speed",
    ],
    secondaryAttributes: [
      "manCoverage",
      "anticipation",
      "agility",
      "acceleration",
    ],
    heightRange: [71, 74],
    weightRange: [195, 220],
  },

  // --- K ---
  {
    name: "power-kicker",
    bucket: "K",
    primaryAttributes: ["kickingPower", "kickingAccuracy"],
    secondaryAttributes: ["composure", "clutch"],
    heightRange: [69, 74],
    weightRange: [185, 215],
  },

  // --- P ---
  {
    name: "directional-punter",
    bucket: "P",
    primaryAttributes: ["puntingPower", "puntingAccuracy"],
    secondaryAttributes: ["composure", "consistency"],
    heightRange: [70, 76],
    weightRange: [195, 225],
  },

  // --- LS ---
  {
    name: "long-snapper",
    bucket: "LS",
    primaryAttributes: ["snapAccuracy"],
    secondaryAttributes: ["consistency", "composure"],
    heightRange: [72, 76],
    weightRange: [230, 260],
  },
] as const;

export function archetypesForBucket(bucket: NeutralBucket): PlayerArchetype[] {
  return PLAYER_ARCHETYPES.filter((a) => a.bucket === bucket);
}
