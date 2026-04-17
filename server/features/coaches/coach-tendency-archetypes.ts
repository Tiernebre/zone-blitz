import type {
  DefensiveTendencies,
  OffensiveTendencies,
} from "@zone-blitz/shared";

/**
 * Coordinator archetypes. Vectors are deliberately
 * recognizable "trees" (Shanahan / Air Raid / Fangio / etc.) rather
 * than uniform random so the hiring market is legible. Values are the
 * archetype's center; the generator applies a small deterministic
 * jitter per coach so two OCs sharing an archetype aren't identical.
 */

export interface OffensiveArchetype {
  name: string;
  vector: OffensiveTendencies;
}

export interface DefensiveArchetype {
  name: string;
  vector: DefensiveTendencies;
}

export const OFFENSIVE_ARCHETYPES: readonly OffensiveArchetype[] = [
  {
    name: "shanahan_wide_zone",
    vector: {
      runPassLean: 35,
      tempo: 45,
      personnelWeight: 65,
      formationUnderCenterShotgun: 35,
      preSnapMotionRate: 85,
      passingStyle: 25,
      passingDepth: 40,
      runGameBlocking: 15,
      rpoIntegration: 25,
    },
  },
  {
    name: "air_raid",
    vector: {
      runPassLean: 80,
      tempo: 85,
      personnelWeight: 15,
      formationUnderCenterShotgun: 90,
      preSnapMotionRate: 35,
      passingStyle: 70,
      passingDepth: 55,
      runGameBlocking: 60,
      rpoIntegration: 65,
    },
  },
  {
    name: "spread_rpo",
    vector: {
      runPassLean: 55,
      tempo: 75,
      personnelWeight: 25,
      formationUnderCenterShotgun: 85,
      preSnapMotionRate: 60,
      passingStyle: 50,
      passingDepth: 50,
      runGameBlocking: 50,
      rpoIntegration: 90,
    },
  },
  {
    name: "pro_style_timing",
    vector: {
      runPassLean: 50,
      tempo: 35,
      personnelWeight: 55,
      formationUnderCenterShotgun: 25,
      preSnapMotionRate: 40,
      passingStyle: 30,
      passingDepth: 35,
      runGameBlocking: 55,
      rpoIntegration: 10,
    },
  },
  {
    name: "vertical_shot",
    vector: {
      runPassLean: 75,
      tempo: 55,
      personnelWeight: 30,
      formationUnderCenterShotgun: 80,
      preSnapMotionRate: 50,
      passingStyle: 65,
      passingDepth: 85,
      runGameBlocking: 55,
      rpoIntegration: 30,
    },
  },
] as const;

export const DEFENSIVE_ARCHETYPES: readonly DefensiveArchetype[] = [
  {
    name: "fangio_two_high",
    vector: {
      frontOddEven: 75,
      gapResponsibility: 60,
      subPackageLean: 60,
      coverageManZone: 75,
      coverageShell: 80,
      cornerPressOff: 70,
      pressureRate: 25,
      disguiseRate: 85,
    },
  },
  {
    name: "multiple_pattern_match",
    vector: {
      frontOddEven: 40,
      gapResponsibility: 70,
      subPackageLean: 55,
      coverageManZone: 55,
      coverageShell: 45,
      cornerPressOff: 25,
      pressureRate: 45,
      disguiseRate: 70,
    },
  },
  {
    name: "blitz_heavy_press_man",
    vector: {
      frontOddEven: 25,
      gapResponsibility: 30,
      subPackageLean: 40,
      coverageManZone: 20,
      coverageShell: 25,
      cornerPressOff: 20,
      pressureRate: 90,
      disguiseRate: 75,
    },
  },
  {
    name: "cover_three_base",
    vector: {
      frontOddEven: 55,
      gapResponsibility: 65,
      subPackageLean: 25,
      coverageManZone: 85,
      coverageShell: 30,
      cornerPressOff: 55,
      pressureRate: 30,
      disguiseRate: 30,
    },
  },
  {
    name: "tampa_two_zone",
    vector: {
      frontOddEven: 70,
      gapResponsibility: 40,
      subPackageLean: 50,
      coverageManZone: 80,
      coverageShell: 70,
      cornerPressOff: 25,
      pressureRate: 25,
      disguiseRate: 40,
    },
  },
] as const;

/**
 * Deterministic FNV-1a-ish hash of a string → non-negative integer.
 * Used so jitter and archetype assignment are reproducible across
 * generator runs for the same coach id without pulling in a PRNG dep.
 */
export function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Apply ±JITTER to a 0–100 center value. Jitter is derived from the
 * coach id and axis name so repeated generation produces the same
 * vector and sibling coordinators within a cluster don't look
 * identical.
 */
export function jitter(
  center: number,
  seed: string,
  axis: string,
  amplitude = 4,
): number {
  const h = hashString(`${seed}:${axis}`);
  const delta = (h % (amplitude * 2 + 1)) - amplitude;
  const raw = center + delta;
  return Math.max(0, Math.min(100, raw));
}

export function pickOffensiveArchetype(
  seed: string,
): OffensiveArchetype {
  return OFFENSIVE_ARCHETYPES[
    hashString(`offense:${seed}`) % OFFENSIVE_ARCHETYPES.length
  ];
}

export function pickDefensiveArchetype(
  seed: string,
): DefensiveArchetype {
  return DEFENSIVE_ARCHETYPES[
    hashString(`defense:${seed}`) % DEFENSIVE_ARCHETYPES.length
  ];
}

/**
 * Public-knowledge derivation: given a coach id + role + specialty,
 * return the offensive/defensive archetype names this coach would have
 * been assigned by `buildTendencies`. Used by the hiring service to
 * surface a scheme label on candidates without re-reading the
 * tendencies table or carrying the archetype as a separate column.
 *
 * Returns null on the side the coach doesn't carry (e.g. a defense-HC
 * has no offensive archetype; a CEO HC has neither).
 */
export function archetypeNamesFor(
  role: string,
  specialty: string | null,
  coachId: string,
): { offensive: string | null; defensive: string | null } {
  const offensiveSide = role === "OC" ||
    (role === "HC" && specialty === "offense");
  const defensiveSide = role === "DC" ||
    (role === "HC" && specialty === "defense");
  return {
    offensive: offensiveSide ? pickOffensiveArchetype(coachId).name : null,
    defensive: defensiveSide ? pickDefensiveArchetype(coachId).name : null,
  };
}

export function offensiveVectorFromArchetype(
  archetype: OffensiveArchetype,
  seed: string,
  amplitude = 4,
): OffensiveTendencies {
  const out = {} as OffensiveTendencies;
  for (const [axis, center] of Object.entries(archetype.vector)) {
    (out as unknown as Record<string, number>)[axis] = jitter(
      center,
      seed,
      axis,
      amplitude,
    );
  }
  return out;
}

export function defensiveVectorFromArchetype(
  archetype: DefensiveArchetype,
  seed: string,
  amplitude = 4,
): DefensiveTendencies {
  const out = {} as DefensiveTendencies;
  for (const [axis, center] of Object.entries(archetype.vector)) {
    (out as unknown as Record<string, number>)[axis] = jitter(
      center,
      seed,
      axis,
      amplitude,
    );
  }
  return out;
}
