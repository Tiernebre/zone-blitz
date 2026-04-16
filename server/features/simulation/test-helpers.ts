import {
  PLAYER_ATTRIBUTE_KEYS,
  type PlayerAttributes,
  type SchemeFingerprint,
} from "@zone-blitz/shared";
import type { CoachingMods, PlayerRuntime, Situation } from "./resolve-play.ts";
import { createRng, mulberry32 } from "./rng.ts";
import type { SeededRng } from "./rng.ts";

export function makeAttributes(
  overrides: Partial<PlayerAttributes> = {},
): PlayerAttributes {
  const base: Partial<PlayerAttributes> = {};
  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    (base as Record<string, number>)[key] = 50;
    (base as Record<string, number>)[`${key}Potential`] = 50;
  }
  return { ...base, ...overrides } as PlayerAttributes;
}

export function makeFingerprint(
  overrides: Partial<SchemeFingerprint> = {},
): SchemeFingerprint {
  return {
    offense: {
      runPassLean: 50,
      tempo: 50,
      personnelWeight: 50,
      formationUnderCenterShotgun: 50,
      preSnapMotionRate: 50,
      passingStyle: 50,
      passingDepth: 50,
      runGameBlocking: 50,
      rpoIntegration: 50,
    },
    defense: {
      frontOddEven: 50,
      gapResponsibility: 50,
      subPackageLean: 50,
      coverageManZone: 50,
      coverageShell: 50,
      cornerPressOff: 50,
      pressureRate: 50,
      disguiseRate: 50,
    },
    overrides: {},
    ...overrides,
  };
}

export function makePlayer(
  id: string,
  bucket: PlayerRuntime["neutralBucket"],
  overrides: Partial<PlayerAttributes> = {},
): PlayerRuntime {
  return {
    playerId: id,
    neutralBucket: bucket,
    attributes: makeAttributes(overrides),
  };
}

export function makeCoachingMods(
  overrides: Partial<CoachingMods> = {},
): CoachingMods {
  return {
    schemeFitBonus: 0,
    situationalBonus: 0,
    aggressiveness: 50,
    ...overrides,
  };
}

export function makeRng(seed = 42): SeededRng {
  return createRng(mulberry32(seed));
}

export function makeSituation(
  overrides: Partial<Situation> = {},
): Situation {
  return { down: 1, distance: 10, yardLine: 30, ...overrides };
}

export function makeStarters(prefix: string): PlayerRuntime[] {
  return [
    makePlayer(`${prefix}-qb`, "QB"),
    makePlayer(`${prefix}-rb`, "RB"),
    makePlayer(`${prefix}-wr1`, "WR"),
    makePlayer(`${prefix}-wr2`, "WR"),
    makePlayer(`${prefix}-te`, "TE"),
    makePlayer(`${prefix}-ot1`, "OT"),
    makePlayer(`${prefix}-ot2`, "OT"),
    makePlayer(`${prefix}-iol1`, "IOL"),
    makePlayer(`${prefix}-iol2`, "IOL"),
    makePlayer(`${prefix}-iol3`, "IOL"),
    makePlayer(`${prefix}-edge1`, "EDGE"),
    makePlayer(`${prefix}-edge2`, "EDGE"),
    makePlayer(`${prefix}-idl1`, "IDL"),
    makePlayer(`${prefix}-idl2`, "IDL"),
    makePlayer(`${prefix}-lb1`, "LB"),
    makePlayer(`${prefix}-lb2`, "LB"),
    makePlayer(`${prefix}-cb1`, "CB"),
    makePlayer(`${prefix}-cb2`, "CB"),
    makePlayer(`${prefix}-s1`, "S"),
    makePlayer(`${prefix}-s2`, "S"),
    makePlayer(`${prefix}-k`, "K"),
    makePlayer(`${prefix}-p`, "P"),
  ];
}
