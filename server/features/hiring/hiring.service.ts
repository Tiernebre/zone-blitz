import { DomainError } from "@zone-blitz/shared";
import type { CoachRole, ScoutRole } from "@zone-blitz/shared";
import type pino from "pino";
import type {
  CandidateScoringContext,
  FranchiseScoringProfile,
  HiringDecisionRow,
  HiringInterestRow,
  HiringInterviewRow,
  HiringOfferRow,
  HiringRepository,
  StaffType,
  UnassignedCandidate,
} from "./hiring.repository.ts";
import {
  type CompetingOffer,
  computePreferenceScore,
  type FranchiseProfile,
  type Incentive,
  type Offer,
  resolveContestForCandidate,
  type SalaryBand,
  type StaffCandidate,
} from "./preference-scoring.ts";

export interface InterestTarget {
  staffType: StaffType;
  staffId: string;
}

export interface DraftOffer {
  staffType: StaffType;
  staffId: string;
  salary: number;
  contractYears: number;
  buyoutMultiplier: string;
  incentives?: Incentive[];
}

export interface HiringState {
  leagueId: string;
  interests: HiringInterestRow[];
  interviews: HiringInterviewRow[];
  offers: HiringOfferRow[];
  decisions: HiringDecisionRow[];
  unassignedCoaches: UnassignedCandidate[];
  unassignedScouts: UnassignedCandidate[];
}

export interface FinalizeBlocker {
  teamId: string;
  missingRoles: string[];
}

export interface FinalizeResult {
  decisions: HiringDecisionRow[];
  blockers: FinalizeBlocker[];
}

export interface HiringService {
  openMarket(leagueId: string): Promise<void>;
  expressInterest(input: {
    leagueId: string;
    teamId: string;
    staffType: StaffType;
    staffId: string;
    stepSlug: string;
  }): Promise<HiringInterestRow>;
  requestInterviews(input: {
    leagueId: string;
    teamId: string;
    stepSlug: string;
    targets: InterestTarget[];
  }): Promise<HiringInterviewRow[]>;
  resolveInterviewDeclines(
    leagueId: string,
    stepSlug: string,
  ): Promise<HiringInterviewRow[]>;
  submitOffers(input: {
    leagueId: string;
    teamId: string;
    stepSlug: string;
    offers: DraftOffer[];
  }): Promise<HiringOfferRow[]>;
  resolveDecisions(
    leagueId: string,
    wave: number,
  ): Promise<HiringDecisionRow[]>;
  finalize(leagueId: string): Promise<FinalizeResult>;
  getHiringState(leagueId: string): Promise<HiringState>;
}

export interface HiringLeagueSummary {
  id: string;
  numberOfTeams: number;
  staffBudget: number;
  interestCap: number;
  interviewsPerWeek: number;
  maxConcurrentOffers: number;
  userTeamId: string | null;
}

export interface HiringLeagueRepository {
  getById(id: string): Promise<HiringLeagueSummary | undefined>;
}

export interface HiringPoolGenerator {
  generatePool(
    input: { leagueId: string; numberOfTeams: number },
  ): Promise<unknown>;
}

// Per ADR 0032 salary bands. The compensation component of the candidate
// preference function compares the offer against the role's market band
// — a salary near the ceiling scores 100, near the floor scores 0.
const COACH_SALARY_BANDS: Record<CoachRole, SalaryBand> = {
  HC: { min: 5_000_000, max: 20_000_000 },
  OC: { min: 1_500_000, max: 6_000_000 },
  DC: { min: 1_500_000, max: 5_000_000 },
  STC: { min: 800_000, max: 2_000_000 },
  QB: { min: 500_000, max: 1_500_000 },
  RB: { min: 300_000, max: 1_200_000 },
  WR: { min: 300_000, max: 1_200_000 },
  TE: { min: 300_000, max: 1_200_000 },
  OL: { min: 300_000, max: 1_200_000 },
  DL: { min: 300_000, max: 1_200_000 },
  LB: { min: 300_000, max: 1_200_000 },
  DB: { min: 300_000, max: 1_200_000 },
  ST_ASSISTANT: { min: 250_000, max: 600_000 },
};

const SCOUT_SALARY_BANDS: Record<ScoutRole, SalaryBand> = {
  DIRECTOR: { min: 250_000, max: 800_000 },
  NATIONAL_CROSS_CHECKER: { min: 150_000, max: 400_000 },
  AREA_SCOUT: { min: 80_000, max: 200_000 },
};

// Wave reserved for finalize auto-assigns. Waves 1 and 2 represent the
// primary and second-wave decision steps; 99 marks the terminal
// finalization step so consumers can distinguish auto-fills from contests.
const FINALIZE_WAVE = 99;

const COORDINATOR_PARENTS: Partial<Record<CoachRole, CoachRole>> = {
  OC: "HC",
  DC: "HC",
  STC: "HC",
  QB: "OC",
  RB: "OC",
  WR: "OC",
  TE: "OC",
  OL: "OC",
  DL: "DC",
  LB: "DC",
  DB: "DC",
  ST_ASSISTANT: "STC",
};

const MANDATORY_COACH_ROLES: CoachRole[] = ["HC"];
const MANDATORY_SCOUT_ROLES: ScoutRole[] = ["DIRECTOR"];

function bandFor(
  staffType: StaffType,
  role: CoachRole | ScoutRole,
): SalaryBand {
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

function toIncentives(raw: unknown): Incentive[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (entry): entry is Incentive =>
      typeof entry === "object" && entry !== null &&
      typeof (entry as Incentive).type === "string" &&
      typeof (entry as Incentive).value === "number",
  );
}

function toOffer(row: HiringOfferRow): Offer {
  return {
    id: row.id,
    franchiseId: row.teamId,
    salary: row.salary,
    contractYears: row.contractYears,
    incentives: toIncentives(row.incentives),
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

function pickReportsTo(
  role: CoachRole,
  signedCoaches: { staffId: string; role: CoachRole }[],
): string | null {
  const parentRole = COORDINATOR_PARENTS[role];
  if (!parentRole) return null;
  const match = signedCoaches.find((c) => c.role === parentRole);
  return match?.staffId ?? null;
}

function buyoutFromMultiplier(
  salary: number,
  contractYears: number,
  multiplier: string,
): number {
  const factor = Number(multiplier);
  if (Number.isNaN(factor)) return 0;
  return Math.round(salary * contractYears * factor);
}

export function createHiringService(deps: {
  repo: HiringRepository;
  leagueRepo: HiringLeagueRepository;
  coachesService: HiringPoolGenerator;
  scoutsService: HiringPoolGenerator;
  log: pino.Logger;
  now?: () => Date;
}): HiringService {
  const log = deps.log.child({ module: "hiring.service" });
  const now = deps.now ?? (() => new Date());

  async function loadLeague(leagueId: string): Promise<HiringLeagueSummary> {
    const league = await deps.leagueRepo.getById(leagueId);
    if (!league) {
      throw new DomainError("NOT_FOUND", `League ${leagueId} not found`);
    }
    return league;
  }

  return {
    async openMarket(leagueId) {
      log.info({ leagueId }, "opening hiring market");
      const league = await loadLeague(leagueId);
      await deps.coachesService.generatePool({
        leagueId,
        numberOfTeams: league.numberOfTeams,
      });
      await deps.scoutsService.generatePool({
        leagueId,
        numberOfTeams: league.numberOfTeams,
      });
    },

    async expressInterest(input) {
      const league = await loadLeague(input.leagueId);
      const interests = await deps.repo.listInterestsByTeam(
        input.leagueId,
        input.teamId,
      );
      const activeCount = interests.filter((i) => i.status === "active").length;
      if (activeCount >= league.interestCap) {
        throw new DomainError(
          "INTEREST_CAP_EXCEEDED",
          `Team ${input.teamId} already has ${activeCount} active interests (cap ${league.interestCap})`,
        );
      }
      return await deps.repo.createInterest({
        leagueId: input.leagueId,
        teamId: input.teamId,
        staffType: input.staffType,
        staffId: input.staffId,
        stepSlug: input.stepSlug,
      });
    },

    async requestInterviews(input) {
      const league = await loadLeague(input.leagueId);
      const existingInterviews = await deps.repo.listInterviewsByTeam(
        input.leagueId,
        input.teamId,
      );
      const existingThisStep = existingInterviews.filter(
        (iv) => iv.stepSlug === input.stepSlug,
      ).length;
      if (existingThisStep + input.targets.length > league.interviewsPerWeek) {
        throw new DomainError(
          "INTERVIEW_CAP_EXCEEDED",
          `Team ${input.teamId} would exceed interviewsPerWeek (${league.interviewsPerWeek}) for step ${input.stepSlug}`,
        );
      }

      const created: HiringInterviewRow[] = [];
      for (const target of input.targets) {
        const interest = await deps.repo.findActiveInterest(
          input.leagueId,
          input.teamId,
          target.staffType,
          target.staffId,
        );
        if (!interest) {
          throw new DomainError(
            "INTEREST_REQUIRED",
            `Team ${input.teamId} has no active interest in ${target.staffType} ${target.staffId}`,
          );
        }
        const row = await deps.repo.createInterview({
          leagueId: input.leagueId,
          teamId: input.teamId,
          staffType: target.staffType,
          staffId: target.staffId,
          stepSlug: input.stepSlug,
        });
        created.push(row);
      }
      return created;
    },

    async resolveInterviewDeclines(leagueId, stepSlug) {
      const interviews = await deps.repo.listInterviewsByStep(
        leagueId,
        stepSlug,
      );
      const pending = interviews.filter((iv) => iv.status === "requested");
      const profiles = new Map<string, FranchiseScoringProfile | undefined>();
      const candidates = new Map<
        string,
        CandidateScoringContext | undefined
      >();
      const updated: HiringInterviewRow[] = [];

      for (const interview of pending) {
        const candidateKey = `${interview.staffType}:${interview.staffId}`;
        if (!candidates.has(candidateKey)) {
          candidates.set(
            candidateKey,
            await deps.repo.getCandidateScoringContext(
              interview.staffType,
              interview.staffId,
            ),
          );
        }
        if (!profiles.has(interview.teamId)) {
          profiles.set(
            interview.teamId,
            await deps.repo.getFranchiseScoringProfile(interview.teamId),
          );
        }
        const candidate = candidates.get(candidateKey);
        const profile = profiles.get(interview.teamId);
        if (!candidate || !profile) {
          updated.push(interview);
          continue;
        }
        const band = bandFor(candidate.staffType, candidate.role);
        const probeOffer: Offer = {
          id: `probe-${interview.id}`,
          franchiseId: profile.teamId,
          salary: Math.round((band.min + band.max) / 2),
          contractYears: 2,
          incentives: [],
        };
        const score = computePreferenceScore(
          toStaffCandidate(candidate),
          toFranchiseProfile(profile),
          probeOffer,
          band,
        );
        const nextStatus = score >= candidate.preferences.minimumThreshold
          ? "completed"
          : "declined";
        const row = await deps.repo.updateInterview(interview.id, {
          status: nextStatus,
        });
        updated.push(row);
      }
      return updated;
    },

    async submitOffers(input) {
      const league = await loadLeague(input.leagueId);
      const existingOffers = await deps.repo.listOffersByTeam(
        input.leagueId,
        input.teamId,
      );
      const concurrent = existingOffers.filter(
        (o) => o.status === "pending",
      ).length;
      if (concurrent + input.offers.length > league.maxConcurrentOffers) {
        throw new DomainError(
          "OFFER_CAP_EXCEEDED",
          `Team ${input.teamId} would exceed maxConcurrentOffers (${league.maxConcurrentOffers})`,
        );
      }

      const signedTotal = await deps.repo.sumSignedStaffSalaries(input.teamId);
      const pendingTotal = existingOffers
        .filter((o) => o.status === "pending")
        .reduce((sum, o) => sum + o.salary, 0);
      const newTotal = input.offers.reduce((sum, o) => sum + o.salary, 0);
      if (signedTotal + pendingTotal + newTotal > league.staffBudget) {
        throw new DomainError(
          "STAFF_BUDGET_EXCEEDED",
          `Team ${input.teamId} would exceed staff budget ${league.staffBudget}`,
        );
      }

      const created: HiringOfferRow[] = [];
      for (const offer of input.offers) {
        const interview = await deps.repo.findInterview(
          input.leagueId,
          input.teamId,
          offer.staffType,
          offer.staffId,
        );
        if (
          !interview || (interview.status !== "completed" &&
            interview.status !== "accepted")
        ) {
          throw new DomainError(
            "INTERVIEW_REQUIRED",
            `Team ${input.teamId} has no completed interview for ${offer.staffType} ${offer.staffId}`,
          );
        }
        const row = await deps.repo.createOffer({
          leagueId: input.leagueId,
          teamId: input.teamId,
          staffType: offer.staffType,
          staffId: offer.staffId,
          stepSlug: input.stepSlug,
          salary: offer.salary,
          contractYears: offer.contractYears,
          buyoutMultiplier: offer.buyoutMultiplier,
          incentives: offer.incentives ?? [],
        });
        created.push(row);
      }
      return created;
    },

    async resolveDecisions(leagueId, wave) {
      log.info({ leagueId, wave }, "resolving hiring decisions");
      const offers = await deps.repo.listPendingOffersByLeague(leagueId);
      const grouped = new Map<string, HiringOfferRow[]>();
      for (const offer of offers) {
        const key = `${offer.staffType}:${offer.staffId}`;
        const list = grouped.get(key) ?? [];
        list.push(offer);
        grouped.set(key, list);
      }

      const profileCache = new Map<
        string,
        FranchiseScoringProfile | undefined
      >();
      async function profileFor(teamId: string) {
        if (!profileCache.has(teamId)) {
          profileCache.set(
            teamId,
            await deps.repo.getFranchiseScoringProfile(teamId),
          );
        }
        return profileCache.get(teamId);
      }

      const decisions: HiringDecisionRow[] = [];
      for (const [, candidateOffers] of grouped) {
        const sample = candidateOffers[0];
        const candidate = await deps.repo.getCandidateScoringContext(
          sample.staffType,
          sample.staffId,
        );
        if (!candidate) continue;
        const competing: CompetingOffer[] = [];
        for (const offer of candidateOffers) {
          const profile = await profileFor(offer.teamId);
          if (!profile) continue;
          competing.push({
            franchise: toFranchiseProfile(profile),
            offer: toOffer(offer),
            roleBand: bandFor(candidate.staffType, candidate.role),
          });
        }

        const result = resolveContestForCandidate(
          toStaffCandidate(candidate),
          competing,
        );

        for (const offer of candidateOffers) {
          const status = offer.id === result.chosenOfferId
            ? "accepted"
            : "rejected";
          await deps.repo.updateOffer(offer.id, { status });
        }

        if (result.chosenOfferId) {
          const winning = candidateOffers.find(
            (o) => o.id === result.chosenOfferId,
          );
          if (winning) {
            const hiredAt = now();
            const buyout = buyoutFromMultiplier(
              winning.salary,
              winning.contractYears,
              winning.buyoutMultiplier,
            );
            if (candidate.staffType === "coach") {
              const signed = await deps.repo.listSignedStaffByTeam(
                leagueId,
                winning.teamId,
              );
              const signedCoaches = signed
                .filter((m) => m.staffType === "coach")
                .map((m) => ({
                  staffId: m.staffId,
                  role: m.role as CoachRole,
                }));
              const reportsToId = pickReportsTo(
                candidate.role as CoachRole,
                signedCoaches,
              );
              await deps.repo.assignCoach(candidate.staffId, {
                teamId: winning.teamId,
                reportsToId,
                contractSalary: winning.salary,
                contractYears: winning.contractYears,
                contractBuyout: buyout,
                hiredAt,
              });
            } else {
              await deps.repo.assignScout(candidate.staffId, {
                teamId: winning.teamId,
                contractSalary: winning.salary,
                contractYears: winning.contractYears,
                contractBuyout: buyout,
                hiredAt,
              });
            }
          }
        }

        const decision = await deps.repo.createDecision({
          leagueId,
          staffType: candidate.staffType,
          staffId: candidate.staffId,
          chosenOfferId: result.chosenOfferId,
          wave,
        });
        decisions.push(decision);
      }
      return decisions;
    },

    async finalize(leagueId) {
      log.info({ leagueId }, "finalizing hiring phase");
      const league = await loadLeague(leagueId);
      const teamSummaries = await deps.repo.listTeamsForLeague(leagueId);
      const unassignedCoaches = await deps.repo.listUnassignedCoaches(leagueId);
      const unassignedScouts = await deps.repo.listUnassignedScouts(leagueId);
      const pickedCoachIds = new Set<string>();
      const pickedScoutIds = new Set<string>();

      const decisions: HiringDecisionRow[] = [];
      const blockers: FinalizeBlocker[] = [];

      for (const team of teamSummaries) {
        const signed = await deps.repo.listSignedStaffByTeam(
          leagueId,
          team.teamId,
        );
        const signedCoachRoles = new Set(
          signed.filter((m) => m.staffType === "coach").map((m) => m.role),
        );
        const signedScoutRoles = new Set(
          signed.filter((m) => m.staffType === "scout").map((m) => m.role),
        );

        const missingCoachRoles = MANDATORY_COACH_ROLES.filter(
          (r) => !signedCoachRoles.has(r),
        );
        const missingScoutRoles = MANDATORY_SCOUT_ROLES.filter(
          (r) => !signedScoutRoles.has(r),
        );

        if (missingCoachRoles.length === 0 && missingScoutRoles.length === 0) {
          continue;
        }

        const isHumanTeam = league.userTeamId === team.teamId;
        if (isHumanTeam) {
          blockers.push({
            teamId: team.teamId,
            missingRoles: [
              ...missingCoachRoles,
              ...missingScoutRoles,
            ],
          });
          continue;
        }

        for (const role of missingCoachRoles) {
          const candidate = pickBestCandidateForRole(
            unassignedCoaches,
            role,
            pickedCoachIds,
          );
          if (!candidate) continue;
          pickedCoachIds.add(candidate.id);
          const band = COACH_SALARY_BANDS[role];
          const salary = Math.round((band.min + band.max) / 2);
          const contractYears = 2;
          const buyout = Math.round(salary * contractYears * 0.5);
          await deps.repo.assignCoach(candidate.id, {
            teamId: team.teamId,
            reportsToId: null,
            contractSalary: salary,
            contractYears,
            contractBuyout: buyout,
            hiredAt: now(),
          });
          const decision = await deps.repo.createDecision({
            leagueId,
            staffType: "coach",
            staffId: candidate.id,
            chosenOfferId: null,
            wave: FINALIZE_WAVE,
          });
          decisions.push(decision);
        }

        for (const role of missingScoutRoles) {
          const candidate = pickBestCandidateForRole(
            unassignedScouts,
            role,
            pickedScoutIds,
          );
          if (!candidate) continue;
          pickedScoutIds.add(candidate.id);
          const band = SCOUT_SALARY_BANDS[role];
          const salary = Math.round((band.min + band.max) / 2);
          const contractYears = 2;
          const buyout = Math.round(salary * contractYears * 0.5);
          await deps.repo.assignScout(candidate.id, {
            teamId: team.teamId,
            contractSalary: salary,
            contractYears,
            contractBuyout: buyout,
            hiredAt: now(),
          });
          const decision = await deps.repo.createDecision({
            leagueId,
            staffType: "scout",
            staffId: candidate.id,
            chosenOfferId: null,
            wave: FINALIZE_WAVE,
          });
          decisions.push(decision);
        }
      }

      return { decisions, blockers };
    },

    async getHiringState(leagueId) {
      log.debug({ leagueId }, "fetching hiring state");
      const [
        interests,
        interviews,
        offers,
        decisions,
        unassignedCoaches,
        unassignedScouts,
      ] = await Promise.all([
        deps.repo.listInterestsByLeague(leagueId),
        deps.repo.listInterviewsByLeague(leagueId),
        deps.repo.listOffersByLeague(leagueId),
        deps.repo.listDecisionsByLeague(leagueId),
        deps.repo.listUnassignedCoaches(leagueId),
        deps.repo.listUnassignedScouts(leagueId),
      ]);
      return {
        leagueId,
        interests,
        interviews,
        offers,
        decisions,
        unassignedCoaches,
        unassignedScouts,
      };
    },
  };
}

function pickBestCandidateForRole(
  pool: UnassignedCandidate[],
  role: string,
  taken: Set<string>,
): UnassignedCandidate | undefined {
  let best: UnassignedCandidate | undefined;
  for (const candidate of pool) {
    if (candidate.role !== role) continue;
    if (taken.has(candidate.id)) continue;
    if (!best) {
      best = candidate;
      continue;
    }
    const score = (candidate.compensationPref ?? 50) +
      (candidate.philosophyFitPref ?? 50);
    const bestScore = (best.compensationPref ?? 50) +
      (best.philosophyFitPref ?? 50);
    if (score > bestScore) best = candidate;
  }
  return best;
}
