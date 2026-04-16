import type {
  DefensiveTendencies,
  NeutralBucket,
  OffensiveTendencies,
  PlayerAttributeKey,
} from "@zone-blitz/shared";

/**
 * Minimal v1 archetype-weight table. Each entry says "when the
 * fingerprint's `axis` sits toward `pole`, these player attributes
 * become important at this position". The full table is multi-PR
 * content work; this first cut covers the positions and axes with
 * the clearest signal so the fit pipeline has something real to
 * return. Positions not listed here fall through to `neutral`.
 */

type OffensiveAxisKey = keyof OffensiveTendencies;
type DefensiveAxisKey = keyof DefensiveTendencies;

type SpectrumAxisKey = OffensiveAxisKey | DefensiveAxisKey;

export type SpectrumSide = "offense" | "defense";

export type SpectrumPole = "low" | "high";

export interface ArchetypeDemand {
  side: SpectrumSide;
  axis: SpectrumAxisKey;
  pole: SpectrumPole;
  attributes: readonly PlayerAttributeKey[];
}

export const POSITION_ARCHETYPE_WEIGHTS: Readonly<
  Partial<Record<NeutralBucket, readonly ArchetypeDemand[]>>
> = {
  CB: [
    {
      side: "defense",
      axis: "coverageManZone",
      pole: "low",
      attributes: ["manCoverage", "speed", "agility"],
    },
    {
      side: "defense",
      axis: "coverageManZone",
      pole: "high",
      attributes: ["zoneCoverage", "footballIq", "anticipation"],
    },
    {
      side: "defense",
      axis: "cornerPressOff",
      pole: "low",
      attributes: ["strength", "manCoverage", "jumping"],
    },
    {
      side: "defense",
      axis: "cornerPressOff",
      pole: "high",
      attributes: ["speed", "zoneCoverage"],
    },
  ],
  S: [
    {
      side: "defense",
      axis: "coverageShell",
      pole: "low",
      attributes: ["tackling", "runDefense", "strength"],
    },
    {
      side: "defense",
      axis: "coverageShell",
      pole: "high",
      attributes: ["zoneCoverage", "anticipation", "speed"],
    },
  ],
  LB: [
    {
      side: "defense",
      axis: "pressureRate",
      pole: "high",
      attributes: ["passRushing", "speed", "acceleration"],
    },
    {
      side: "defense",
      axis: "gapResponsibility",
      pole: "low",
      attributes: ["acceleration", "blockShedding"],
    },
    {
      side: "defense",
      axis: "gapResponsibility",
      pole: "high",
      attributes: ["strength", "runDefense"],
    },
  ],
  EDGE: [
    {
      side: "defense",
      axis: "frontOddEven",
      pole: "high",
      attributes: ["passRushing", "acceleration"],
    },
    {
      side: "defense",
      axis: "pressureRate",
      pole: "high",
      attributes: ["passRushing", "agility"],
    },
  ],
  IDL: [
    {
      side: "defense",
      axis: "frontOddEven",
      pole: "low",
      attributes: ["strength", "blockShedding", "runDefense"],
    },
    {
      side: "defense",
      axis: "pressureRate",
      pole: "high",
      attributes: ["passRushing", "agility"],
    },
  ],
  QB: [
    {
      side: "offense",
      axis: "passingStyle",
      pole: "low",
      attributes: ["accuracyShort", "release", "anticipation"],
    },
    {
      side: "offense",
      axis: "passingStyle",
      pole: "high",
      attributes: ["accuracyOnTheRun", "elusiveness", "composure"],
    },
    {
      side: "offense",
      axis: "passingDepth",
      pole: "high",
      attributes: ["armStrength", "accuracyDeep"],
    },
    {
      side: "offense",
      axis: "passingDepth",
      pole: "low",
      attributes: ["accuracyShort", "accuracyMedium", "touch"],
    },
  ],
  WR: [
    {
      side: "offense",
      axis: "passingDepth",
      pole: "high",
      attributes: ["speed", "contestedCatching", "jumping"],
    },
    {
      side: "offense",
      axis: "passingDepth",
      pole: "low",
      attributes: ["routeRunning", "catching", "runAfterCatch"],
    },
    {
      side: "offense",
      axis: "preSnapMotionRate",
      pole: "high",
      attributes: ["routeRunning", "acceleration"],
    },
  ],
  TE: [
    {
      side: "offense",
      axis: "personnelWeight",
      pole: "high",
      attributes: ["runBlocking", "strength", "catching"],
    },
    {
      side: "offense",
      axis: "personnelWeight",
      pole: "low",
      attributes: ["routeRunning", "speed", "catching"],
    },
  ],
  OT: [
    {
      side: "offense",
      axis: "runGameBlocking",
      pole: "low",
      attributes: ["agility", "acceleration", "runBlocking"],
    },
    {
      side: "offense",
      axis: "runGameBlocking",
      pole: "high",
      attributes: ["strength", "runBlocking"],
    },
    {
      side: "offense",
      axis: "formationUnderCenterShotgun",
      pole: "high",
      attributes: ["passBlocking", "agility"],
    },
  ],
  IOL: [
    {
      side: "offense",
      axis: "runGameBlocking",
      pole: "low",
      attributes: ["agility", "acceleration", "runBlocking"],
    },
    {
      side: "offense",
      axis: "runGameBlocking",
      pole: "high",
      attributes: ["strength", "runBlocking"],
    },
    {
      side: "offense",
      axis: "formationUnderCenterShotgun",
      pole: "high",
      attributes: ["passBlocking", "agility"],
    },
  ],
  RB: [
    {
      side: "offense",
      axis: "runGameBlocking",
      pole: "low",
      attributes: ["agility", "acceleration", "elusiveness"],
    },
    {
      side: "offense",
      axis: "runGameBlocking",
      pole: "high",
      attributes: ["strength", "ballCarrying"],
    },
    {
      side: "offense",
      axis: "runPassLean",
      pole: "high",
      attributes: ["catching", "runAfterCatch", "routeRunning"],
    },
  ],
} as const;
