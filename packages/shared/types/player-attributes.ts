export const PHYSICAL_ATTRIBUTE_KEYS = [
  "speed",
  "acceleration",
  "agility",
  "strength",
  "jumping",
  "stamina",
  "durability",
] as const;

export const TECHNICAL_ATTRIBUTE_KEYS = [
  "armStrength",
  "accuracyShort",
  "accuracyMedium",
  "accuracyDeep",
  "accuracyOnTheRun",
  "touch",
  "release",
  "ballCarrying",
  "elusiveness",
  "routeRunning",
  "catching",
  "contestedCatching",
  "runAfterCatch",
  "passBlocking",
  "runBlocking",
  "blockShedding",
  "tackling",
  "manCoverage",
  "zoneCoverage",
  "passRushing",
  "runDefense",
  "kickingPower",
  "kickingAccuracy",
  "puntingPower",
  "puntingAccuracy",
  "snapAccuracy",
] as const;

export const MENTAL_ATTRIBUTE_KEYS = [
  "footballIq",
  "decisionMaking",
  "anticipation",
  "composure",
  "clutch",
  "consistency",
  "workEthic",
  "coachability",
  "leadership",
] as const;

export const PERSONALITY_ATTRIBUTE_KEYS = [
  "greed",
  "loyalty",
  "ambition",
  "vanity",
  "schemeAttachment",
  "mediaSensitivity",
] as const;

export const PLAYER_ATTRIBUTE_KEYS = [
  ...PHYSICAL_ATTRIBUTE_KEYS,
  ...TECHNICAL_ATTRIBUTE_KEYS,
  ...MENTAL_ATTRIBUTE_KEYS,
  ...PERSONALITY_ATTRIBUTE_KEYS,
] as const;

export type PhysicalAttributeKey = typeof PHYSICAL_ATTRIBUTE_KEYS[number];
export type TechnicalAttributeKey = typeof TECHNICAL_ATTRIBUTE_KEYS[number];
export type MentalAttributeKey = typeof MENTAL_ATTRIBUTE_KEYS[number];
export type PersonalityAttributeKey = typeof PERSONALITY_ATTRIBUTE_KEYS[number];
export type PlayerAttributeKey = typeof PLAYER_ATTRIBUTE_KEYS[number];

type CurrentValues = { [K in PlayerAttributeKey]: number };
type PotentialValues = { [K in PlayerAttributeKey as `${K}Potential`]: number };

export type PlayerAttributes = CurrentValues & PotentialValues;
