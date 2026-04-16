import type { CoachRole, ScoutRole } from "@zone-blitz/shared";
import type pino from "pino";
import type {
  CandidateScoringContext,
  FranchiseScoringProfile,
  HiringInterestRow,
  HiringInterviewRow,
  HiringOfferRow,
  HiringRepository,
  StaffType,
  UnassignedCandidate,
} from "./hiring.repository.ts";
import type {
  DraftOffer,
  HiringLeagueRepository,
  HiringLeagueSummary,
  HiringService,
} from "./hiring.service.ts";
import {
  computePreferenceScore,
  type FranchiseProfile,
  type MarketTier,
  type Offer,
  type SalaryBand,
  type StaffCandidate,
} from "./preference-scoring.ts";
import { COACH_SALARY_BANDS, SCOUT_SALARY_BANDS } from "./staff-assembly.ts";

// NPC teams only contest for leadership roles in the GM-facing pipeline. The
// rest of the staff is auto-assembled at finalize.
const COACH_ROLE_PRIORITY: Partial<Record<CoachRole, number>> = {
  HC: 0,
};

const SCOUT_ROLE_PRIORITY: Partial<Record<ScoutRole, number>> = {
  DIRECTOR: 3,
};

// Market-tier bias applied on top of the mid-band salary when an NPC team
// drafts an offer. Large-market NPCs push slightly above mid; small-market
// NPCs pull slightly below. Kept small so it does not blow the budget.
const MARKET_TIER_OFFER_BIAS: Record<MarketTier, number> = {
  large: 0.1,
  medium: 0,
  small: -0.1,
};

const DEFAULT_CONTRACT_YEARS = 3;
const DEFAULT_BUYOUT_MULTIPLIER = "0.50";

function priorityFor(staffType: StaffType, role: string): number {
  if (staffType === "coach") {
    return COACH_ROLE_PRIORITY[role as CoachRole] ?? 99;
  }
  return SCOUT_ROLE_PRIORITY[role as ScoutRole] ?? 99;
}

function bandFor(staffType: StaffType, role: string): SalaryBand {
  if (staffType === "coach") {
    return COACH_SALARY_BANDS[role as CoachRole];
  }
  return SCOUT_SALARY_BANDS[role as ScoutRole];
}

function toStaffCandidate(ctx: CandidateScoringContext): StaffCandidate {
  if (ctx.staffType === "coach") {
    return {
      staffType: "coach",
      id: ctx.staffId,
      role: ctx.role as CoachRole,
      offense: ctx.offense,
      defense: ctx.defense,
      ...ctx.preferences,
    };
  }
  return {
    staffType: "scout",
    id: ctx.staffId,
    role: ctx.role as ScoutRole,
    ...ctx.preferences,
  };
}

function toFranchiseProfile(
  profile: FranchiseScoringProfile,
): FranchiseProfile {
  return {
    franchiseId: profile.teamId,
    marketTier: profile.marketTier,
    existingStaff: profile.existingStaff,
  };
}

function probeOffer(
  franchiseId: string,
  band: SalaryBand,
): Offer {
  return {
    id: `probe-${franchiseId}`,
    franchiseId,
    salary: Math.round((band.min + band.max) / 2),
    contractYears: DEFAULT_CONTRACT_YEARS,
    incentives: [],
  };
}

function reverseScore(
  context: CandidateScoringContext,
  profile: FranchiseScoringProfile,
): number {
  const band = bandFor(context.staffType, context.role);
  return computePreferenceScore(
    toStaffCandidate(context),
    toFranchiseProfile(profile),
    probeOffer(profile.teamId, band),
    band,
  );
}

function adjustedOfferSalary(
  staffType: StaffType,
  role: string,
  marketTier: MarketTier,
): number {
  const band = bandFor(staffType, role);
  const mid = (band.min + band.max) / 2;
  const bias = MARKET_TIER_OFFER_BIAS[marketTier];
  const spread = (band.max - band.min) / 2;
  const candidate = Math.round(mid + bias * spread);
  if (candidate < band.min) return band.min;
  if (candidate > band.max) return band.max;
  return candidate;
}

interface RankedCandidate {
  staffType: StaffType;
  staffId: string;
  role: string;
  priority: number;
  score: number;
  tiebreak: number;
}

function sortRanked(candidates: RankedCandidate[]): RankedCandidate[] {
  return [...candidates].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (a.score !== b.score) return b.score - a.score;
    if (a.tiebreak !== b.tiebreak) return a.tiebreak - b.tiebreak;
    return a.staffId < b.staffId ? -1 : a.staffId > b.staffId ? 1 : 0;
  });
}

export interface NpcHiringAi {
  executeNpcInterest(input: {
    leagueId: string;
    npcTeamIds: readonly string[];
    stepSlug: string;
  }): Promise<HiringInterestRow[]>;
  executeNpcInterviews(input: {
    leagueId: string;
    npcTeamIds: readonly string[];
    stepSlug: string;
  }): Promise<HiringInterviewRow[]>;
  executeNpcOffers(input: {
    leagueId: string;
    npcTeamIds: readonly string[];
    stepSlug: string;
  }): Promise<HiringOfferRow[]>;
}

/**
 * Per-step NPC hiring AI. The strategy is to use the
 * candidate preference function in reverse — for each NPC franchise, rank
 * still-needed candidates by how likely each would accept a probe offer from
 * that team, then express interest, request interviews, and submit offers in
 * role-priority order while respecting the league's bandwidth caps and staff
 * budget.
 */
export function createNpcHiringAi(deps: {
  repo: HiringRepository;
  leagueRepo: HiringLeagueRepository;
  service: HiringService;
  log: pino.Logger;
  rng?: () => number;
}): NpcHiringAi {
  const log = deps.log.child({ module: "hiring.npcAi" });
  const rng = deps.rng ?? Math.random;

  async function loadLeague(leagueId: string): Promise<HiringLeagueSummary> {
    const league = await deps.leagueRepo.getById(leagueId);
    if (!league) {
      throw new Error(`League ${leagueId} not found`);
    }
    return league;
  }

  async function rankUnassignedForTeam(
    leagueId: string,
    teamId: string,
    neededCoachRoles: Set<string>,
    neededScoutRoles: Set<string>,
  ): Promise<RankedCandidate[]> {
    const maybeProfile = await deps.repo.getFranchiseScoringProfile(teamId);
    if (!maybeProfile) return [];
    const profile: FranchiseScoringProfile = maybeProfile;

    const [coaches, scouts] = await Promise.all([
      deps.repo.listUnassignedCoaches(leagueId),
      deps.repo.listUnassignedScouts(leagueId),
    ]);

    const ranked: RankedCandidate[] = [];

    async function rankPool(
      pool: UnassignedCandidate[],
      staffType: StaffType,
      needed: Set<string>,
    ) {
      for (const candidate of pool) {
        if (!needed.has(candidate.role)) continue;
        const context = await deps.repo.getCandidateScoringContext(
          staffType,
          candidate.id,
        );
        if (!context) continue;
        ranked.push({
          staffType,
          staffId: candidate.id,
          role: candidate.role,
          priority: priorityFor(staffType, candidate.role),
          score: reverseScore(context, profile),
          tiebreak: rng(),
        });
      }
    }

    await rankPool(coaches, "coach", neededCoachRoles);
    await rankPool(scouts, "scout", neededScoutRoles);

    return sortRanked(ranked);
  }

  function neededRolesFor(
    signedCoachRoles: Set<string>,
    signedScoutRoles: Set<string>,
  ): { coachRoles: Set<string>; scoutRoles: Set<string> } {
    const coachRoles = new Set<string>(
      Object.keys(COACH_ROLE_PRIORITY).filter(
        (role) => !signedCoachRoles.has(role),
      ),
    );
    const scoutRoles = new Set<string>(
      Object.keys(SCOUT_ROLE_PRIORITY).filter(
        (role) => !signedScoutRoles.has(role),
      ),
    );
    return { coachRoles, scoutRoles };
  }

  return {
    async executeNpcInterest(input) {
      log.info(
        { leagueId: input.leagueId, teamCount: input.npcTeamIds.length },
        "executing npc interest",
      );
      const league = await loadLeague(input.leagueId);
      const created: HiringInterestRow[] = [];

      for (const teamId of input.npcTeamIds) {
        const [interests, signed] = await Promise.all([
          deps.repo.listInterestsByTeam(input.leagueId, teamId),
          deps.repo.listSignedStaffByTeam(input.leagueId, teamId),
        ]);
        const activeInterestIds = new Set(
          interests
            .filter((i) => i.status === "active")
            .map((i) => `${i.staffType}:${i.staffId}`),
        );
        const activeCount = activeInterestIds.size;
        const slots = Math.max(0, league.interestCap - activeCount);
        if (slots === 0) continue;

        const signedCoachRoles = new Set(
          signed.filter((m) => m.staffType === "coach").map((m) => m.role),
        );
        const signedScoutRoles = new Set(
          signed.filter((m) => m.staffType === "scout").map((m) => m.role),
        );
        const { coachRoles, scoutRoles } = neededRolesFor(
          signedCoachRoles,
          signedScoutRoles,
        );

        const ranked = await rankUnassignedForTeam(
          input.leagueId,
          teamId,
          coachRoles,
          scoutRoles,
        );

        for (const entry of ranked) {
          if (created.filter((c) => c.teamId === teamId).length >= slots) {
            break;
          }
          const key = `${entry.staffType}:${entry.staffId}`;
          if (activeInterestIds.has(key)) continue;
          const row = await deps.service.expressInterest({
            leagueId: input.leagueId,
            teamId,
            staffType: entry.staffType,
            staffId: entry.staffId,
            stepSlug: input.stepSlug,
          });
          created.push(row);
          activeInterestIds.add(key);
        }
      }

      return created;
    },

    async executeNpcInterviews(input) {
      log.info(
        { leagueId: input.leagueId, teamCount: input.npcTeamIds.length },
        "executing npc interviews",
      );
      const league = await loadLeague(input.leagueId);
      const created: HiringInterviewRow[] = [];

      for (const teamId of input.npcTeamIds) {
        const [interests, interviews, maybeProfile] = await Promise.all([
          deps.repo.listInterestsByTeam(input.leagueId, teamId),
          deps.repo.listInterviewsByTeam(input.leagueId, teamId),
          deps.repo.getFranchiseScoringProfile(teamId),
        ]);
        if (!maybeProfile) continue;
        const profile = maybeProfile;

        const existingThisStep = interviews.filter(
          (iv) => iv.stepSlug === input.stepSlug,
        ).length;
        const slots = Math.max(
          0,
          league.interviewsPerWeek - existingThisStep,
        );
        if (slots === 0) continue;

        const alreadyInterviewed = new Set(
          interviews.map((iv) => `${iv.staffType}:${iv.staffId}`),
        );

        const ranked: RankedCandidate[] = [];
        for (const interest of interests) {
          if (interest.status !== "active") continue;
          const key = `${interest.staffType}:${interest.staffId}`;
          if (alreadyInterviewed.has(key)) continue;
          const context = await deps.repo.getCandidateScoringContext(
            interest.staffType,
            interest.staffId,
          );
          if (!context) continue;
          ranked.push({
            staffType: interest.staffType,
            staffId: interest.staffId,
            role: context.role,
            priority: priorityFor(interest.staffType, context.role),
            score: reverseScore(context, profile),
            tiebreak: rng(),
          });
        }

        const picked = sortRanked(ranked).slice(0, slots);
        if (picked.length === 0) continue;

        const rows = await deps.service.requestInterviews({
          leagueId: input.leagueId,
          teamId,
          stepSlug: input.stepSlug,
          targets: picked.map((p) => ({
            staffType: p.staffType,
            staffId: p.staffId,
          })),
        });
        created.push(...rows);
      }

      return created;
    },

    async executeNpcOffers(input) {
      log.info(
        { leagueId: input.leagueId, teamCount: input.npcTeamIds.length },
        "executing npc offers",
      );
      const league = await loadLeague(input.leagueId);
      const created: HiringOfferRow[] = [];

      for (const teamId of input.npcTeamIds) {
        const [interviews, offers, maybeProfile, signedTotal] = await Promise
          .all([
            deps.repo.listInterviewsByTeam(input.leagueId, teamId),
            deps.repo.listOffersByTeam(input.leagueId, teamId),
            deps.repo.getFranchiseScoringProfile(teamId),
            deps.repo.sumSignedStaffSalaries(teamId),
          ]);
        if (!maybeProfile) continue;
        const profile = maybeProfile;

        const pendingOffers = offers.filter((o) => o.status === "pending");
        const pendingSalary = pendingOffers.reduce(
          (sum, o) => sum + o.salary,
          0,
        );
        const offerSlots = Math.max(
          0,
          league.maxConcurrentOffers - pendingOffers.length,
        );
        if (offerSlots === 0) continue;

        const alreadyOffered = new Set(
          offers
            .filter((o) => o.status === "pending" || o.status === "accepted")
            .map((o) => `${o.staffType}:${o.staffId}`),
        );

        const eligibleInterviews = interviews.filter((iv) =>
          (iv.status === "completed" || iv.status === "accepted") &&
          !alreadyOffered.has(`${iv.staffType}:${iv.staffId}`)
        );

        const ranked: RankedCandidate[] = [];
        for (const interview of eligibleInterviews) {
          const context = await deps.repo.getCandidateScoringContext(
            interview.staffType,
            interview.staffId,
          );
          if (!context) continue;
          ranked.push({
            staffType: interview.staffType,
            staffId: interview.staffId,
            role: context.role,
            priority: priorityFor(interview.staffType, context.role),
            score: reverseScore(context, profile),
            tiebreak: rng(),
          });
        }

        const ordered = sortRanked(ranked);
        const drafts: DraftOffer[] = [];
        let runningSalary = signedTotal + pendingSalary;

        for (const entry of ordered) {
          if (drafts.length >= offerSlots) break;
          const salary = adjustedOfferSalary(
            entry.staffType,
            entry.role,
            profile.marketTier,
          );
          if (runningSalary + salary > league.staffBudget) continue;
          drafts.push({
            staffType: entry.staffType,
            staffId: entry.staffId,
            salary,
            contractYears: DEFAULT_CONTRACT_YEARS,
            buyoutMultiplier: DEFAULT_BUYOUT_MULTIPLIER,
          });
          runningSalary += salary;
        }

        if (drafts.length === 0) continue;

        const rows = await deps.service.submitOffers({
          leagueId: input.leagueId,
          teamId,
          stepSlug: input.stepSlug,
          offers: drafts,
        });
        created.push(...rows);
      }

      return created;
    },
  };
}
