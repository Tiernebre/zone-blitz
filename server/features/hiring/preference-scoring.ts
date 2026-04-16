import {
  type CoachRole,
  DEFENSIVE_TENDENCY_KEYS,
  type DefensiveTendencies,
  type MarketTier,
  OFFENSIVE_TENDENCY_KEYS,
  type OffensiveTendencies,
  type ScoutRole,
} from "@zone-blitz/shared";

/**
 * Pure preference-scoring engine for the multi-week staff hiring phase
 * described in ADR 0032 and ADR 0023. A candidate evaluates each
 * competing offer against a weighted preference function; the highest
 * score above the candidate's minimum threshold wins. No DB access,
 * no IO — the caller supplies fully assembled inputs.
 */

export type StaffType = "coach" | "scout";

export type { MarketTier };

interface StaffCandidateBase {
  id: string;
  marketTierPref: number;
  philosophyFitPref: number;
  staffFitPref: number;
  compensationPref: number;
  minimumThreshold: number;
}

export interface CoachCandidate extends StaffCandidateBase {
  staffType: "coach";
  role: CoachRole;
  offense: OffensiveTendencies | null;
  defense: DefensiveTendencies | null;
}

export interface ScoutCandidate extends StaffCandidateBase {
  staffType: "scout";
  role: ScoutRole;
}

export type StaffCandidate = CoachCandidate | ScoutCandidate;

export interface FranchiseStaffMember {
  staffType: StaffType;
  role: CoachRole | ScoutRole;
  offense: OffensiveTendencies | null;
  defense: DefensiveTendencies | null;
}

export interface FranchiseProfile {
  franchiseId: string;
  marketTier: MarketTier;
  existingStaff: FranchiseStaffMember[];
}

export interface Incentive {
  type: string;
  value: number;
}

export interface Offer {
  id: string;
  franchiseId: string;
  salary: number;
  contractYears: number;
  incentives: Incentive[];
}

export interface SalaryBand {
  min: number;
  max: number;
}

export interface CompetingOffer {
  franchise: FranchiseProfile;
  offer: Offer;
  roleBand: SalaryBand;
}

const MARKET_TIER_SCORES: Record<MarketTier, number> = {
  large: 100,
  medium: 60,
  small: 25,
};

export function marketTierScore(tier: MarketTier): number {
  return MARKET_TIER_SCORES[tier];
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function tendencySimilarity(
  a: Record<string, number>,
  b: Record<string, number>,
  keys: readonly string[],
): number {
  let totalDelta = 0;
  for (const key of keys) {
    totalDelta += Math.abs((a[key] ?? 0) - (b[key] ?? 0));
  }
  const avgDelta = totalDelta / keys.length;
  return clamp(100 - avgDelta, 0, 100);
}

function offensiveSimilarity(
  a: OffensiveTendencies,
  b: OffensiveTendencies,
): number {
  return tendencySimilarity(
    a as unknown as Record<string, number>,
    b as unknown as Record<string, number>,
    OFFENSIVE_TENDENCY_KEYS,
  );
}

function defensiveSimilarity(
  a: DefensiveTendencies,
  b: DefensiveTendencies,
): number {
  return tendencySimilarity(
    a as unknown as Record<string, number>,
    b as unknown as Record<string, number>,
    DEFENSIVE_TENDENCY_KEYS,
  );
}

function coachTendencies(
  candidate: StaffCandidate,
):
  | { offense: OffensiveTendencies | null; defense: DefensiveTendencies | null }
  | null {
  if (candidate.staffType !== "coach") return null;
  if (candidate.offense === null && candidate.defense === null) return null;
  return { offense: candidate.offense, defense: candidate.defense };
}

function pickFranchiseCoordinator(
  existingStaff: readonly FranchiseStaffMember[],
  side: "offense" | "defense",
): FranchiseStaffMember | null {
  const sideRole = side === "offense" ? "OC" : "DC";
  const match = existingStaff.find((member) =>
    member.staffType === "coach" && member.role === sideRole &&
    (side === "offense" ? member.offense !== null : member.defense !== null)
  );
  return match ?? null;
}

export function philosophyFitScore(
  candidate: StaffCandidate,
  franchise: FranchiseProfile,
): number {
  const tendencies = coachTendencies(candidate);
  if (!tendencies) return 50;

  const matches: number[] = [];
  if (tendencies.offense) {
    const coord = pickFranchiseCoordinator(
      franchise.existingStaff,
      "offense",
    );
    if (coord?.offense) {
      matches.push(offensiveSimilarity(tendencies.offense, coord.offense));
    }
  }
  if (tendencies.defense) {
    const coord = pickFranchiseCoordinator(
      franchise.existingStaff,
      "defense",
    );
    if (coord?.defense) {
      matches.push(defensiveSimilarity(tendencies.defense, coord.defense));
    }
  }

  if (matches.length === 0) return 50;
  return matches.reduce((sum, value) => sum + value, 0) / matches.length;
}

export function staffFitScore(
  candidate: StaffCandidate,
  franchise: FranchiseProfile,
): number {
  const tendencies = coachTendencies(candidate);
  if (!tendencies) return 50;

  const comparisons: number[] = [];
  for (const member of franchise.existingStaff) {
    if (member.staffType !== "coach") continue;
    if (tendencies.offense && member.offense) {
      comparisons.push(offensiveSimilarity(tendencies.offense, member.offense));
    }
    if (tendencies.defense && member.defense) {
      comparisons.push(defensiveSimilarity(tendencies.defense, member.defense));
    }
  }

  if (comparisons.length === 0) return 50;
  return comparisons.reduce((sum, value) => sum + value, 0) /
    comparisons.length;
}

export function compensationScore(offer: Offer, band: SalaryBand): number {
  const incentiveTotal = offer.incentives.reduce(
    (sum, entry) => sum + entry.value,
    0,
  );
  const effectivePay = offer.salary + incentiveTotal;
  const range = band.max - band.min;
  if (range <= 0) return effectivePay >= band.max ? 100 : 0;
  const normalized = ((effectivePay - band.min) / range) * 100;
  return clamp(normalized, 0, 100);
}

export function computePreferenceScore(
  candidate: StaffCandidate,
  franchise: FranchiseProfile,
  offer: Offer,
  roleBand: SalaryBand,
): number {
  const totalWeight = candidate.marketTierPref + candidate.philosophyFitPref +
    candidate.staffFitPref + candidate.compensationPref;
  if (totalWeight === 0) return 50;

  const marketComponent = candidate.marketTierPref *
    marketTierScore(franchise.marketTier);
  const philosophyComponent = candidate.philosophyFitPref *
    philosophyFitScore(candidate, franchise);
  const staffComponent = candidate.staffFitPref *
    staffFitScore(candidate, franchise);
  const compComponent = candidate.compensationPref *
    compensationScore(offer, roleBand);

  return (marketComponent + philosophyComponent + staffComponent +
    compComponent) / totalWeight;
}

interface ScoredOffer {
  competing: CompetingOffer;
  score: number;
}

function compensationTotal(offer: Offer): number {
  return offer.salary +
    offer.incentives.reduce((sum, entry) => sum + entry.value, 0);
}

export function resolveContestForCandidate(
  candidate: StaffCandidate,
  offers: readonly CompetingOffer[],
  rng: () => number = Math.random,
): { chosenOfferId: string | null } {
  if (offers.length === 0) return { chosenOfferId: null };

  const scored: ScoredOffer[] = offers
    .map((competing) => ({
      competing,
      score: computePreferenceScore(
        candidate,
        competing.franchise,
        competing.offer,
        competing.roleBand,
      ),
    }))
    .filter((entry) => entry.score >= candidate.minimumThreshold);

  if (scored.length === 0) return { chosenOfferId: null };

  const bestScore = Math.max(...scored.map((entry) => entry.score));
  const topByScore = scored.filter((entry) => entry.score === bestScore);
  if (topByScore.length === 1) {
    return { chosenOfferId: topByScore[0].competing.offer.id };
  }

  const bestComp = Math.max(
    ...topByScore.map((entry) => compensationTotal(entry.competing.offer)),
  );
  const topByComp = topByScore.filter((entry) =>
    compensationTotal(entry.competing.offer) === bestComp
  );
  if (topByComp.length === 1) {
    return { chosenOfferId: topByComp[0].competing.offer.id };
  }

  const index = Math.min(
    topByComp.length - 1,
    Math.floor(rng() * topByComp.length),
  );
  return { chosenOfferId: topByComp[index].competing.offer.id };
}
