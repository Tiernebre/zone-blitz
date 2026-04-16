import { DomainError } from "@zone-blitz/shared";
import type {
  CoachRole,
  HiringCandidateDetail,
  HiringCandidateSummary,
  HiringStaffType,
  ScoutRole,
} from "@zone-blitz/shared";
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
  type StaffCandidate,
} from "./preference-scoring.ts";
import {
  bandFor,
  COORDINATOR_PARENTS,
  FINALIZE_WAVE,
  INTERVIEW_PROBE_YEARS,
  PROBE_OFFER_ID_PREFIX,
  salaryMidpoint,
} from "./hiring-constants.ts";
import { archetypeNamesFor } from "../coaches/coach-tendency-archetypes.ts";
import { type SignedCoachRef, signedCoachRefs } from "./hiring-signed-staff.ts";
import {
  assembleCoachingStaff,
  assembleScoutingStaff,
  poolMemberQuality,
  type StaffPoolMember,
} from "./staff-assembly.ts";

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

export interface TeamHiringState {
  leagueId: string;
  teamId: string;
  staffBudget: number;
  remainingBudget: number;
  interests: HiringInterestRow[];
  interviews: HiringInterviewRow[];
  offers: HiringOfferRow[];
  decisions: HiringDecisionRow[];
}

export interface CandidateFilter {
  role?: string;
  staffType?: HiringStaffType;
}

export interface FinalizeResult {
  decisions: HiringDecisionRow[];
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
  getTeamHiringState(
    leagueId: string,
    teamId: string,
  ): Promise<TeamHiringState>;
  listCandidates(
    leagueId: string,
    filter?: CandidateFilter,
  ): Promise<HiringCandidateSummary[]>;
  getCandidateDetail(
    leagueId: string,
    candidateId: string,
    viewerTeamId?: string,
  ): Promise<HiringCandidateDetail | undefined>;
  resolveCandidate(
    leagueId: string,
    candidateId: string,
  ): Promise<{ staffType: StaffType; staffId: string } | undefined>;
  listDecisions(
    leagueId: string,
    wave?: number,
  ): Promise<HiringDecisionRow[]>;
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

// GM-facing hiring market only surfaces league-leader roles. Subordinate
// staff (coordinators, position coaches, NCC, area scouts) are auto-assembled
// after the leader signs.
const LEADERSHIP_COACH_ROLES = new Set<string>(["HC"]);
const LEADERSHIP_SCOUT_ROLES = new Set<string>(["DIRECTOR"]);

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
  signedCoaches: SignedCoachRef[],
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

function sumPreferences(ctx: CandidateScoringContext): number {
  return ctx.preferences.marketTierPref +
    ctx.preferences.philosophyFitPref +
    ctx.preferences.staffFitPref +
    ctx.preferences.compensationPref;
}

export function createHiringService(deps: {
  repo: HiringRepository;
  leagueRepo: HiringLeagueRepository;
  coachesService: HiringPoolGenerator;
  scoutsService: HiringPoolGenerator;
  log: pino.Logger;
  now?: () => Date;
  rng?: () => number;
}): HiringService {
  const log = deps.log.child({ module: "hiring.service" });
  const now = deps.now ?? (() => new Date());
  const rng = deps.rng ?? Math.random;

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
          id: `${PROBE_OFFER_ID_PREFIX}${interview.id}`,
          franchiseId: profile.teamId,
          salary: salaryMidpoint(band),
          contractYears: INTERVIEW_PROBE_YEARS,
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
              const reportsToId = pickReportsTo(
                candidate.role as CoachRole,
                signedCoachRefs(signed),
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

      const decisions: HiringDecisionRow[] = [];
      const pickedCoachIds = new Set<string>();
      const pickedScoutIds = new Set<string>();

      // Track total league-wide spend so the staff budget covers every team's
      // assembly together (HC/DoS contracts already counted via repo).
      let leagueSpentOnAssembly = 0;

      function coachPool(): StaffPoolMember[] {
        return unassignedCoaches
          .filter((c) => !pickedCoachIds.has(c.id))
          .map((c) => ({
            id: c.id,
            role: c.role,
            quality: poolMemberQuality(c),
          }));
      }
      function scoutPool(): StaffPoolMember[] {
        return unassignedScouts
          .filter((s) => !pickedScoutIds.has(s.id))
          .map((s) => ({
            id: s.id,
            role: s.role,
            quality: poolMemberQuality(s),
          }));
      }

      for (const team of teamSummaries) {
        const signed = await deps.repo.listSignedStaffByTeam(
          leagueId,
          team.teamId,
        );
        const signedTotalSalary = signed.reduce(
          (sum, m) => sum + m.contractSalary,
          0,
        );
        const remainingBudget = league.staffBudget - signedTotalSalary -
          leagueSpentOnAssembly;
        const signedCoaches = signedCoachRefs(signed);

        // Build coaching staff under HC.
        const hc = signedCoaches.find((c) => c.role === "HC");
        if (hc) {
          const hcCtx = await deps.repo.getCandidateScoringContext(
            "coach",
            hc.staffId,
          );
          const hcQuality = hcCtx ? sumPreferences(hcCtx) : 200;
          const result = assembleCoachingStaff({
            hcQuality,
            pool: coachPool(),
            remainingBudget,
            rng,
          });
          for (const a of result.assignments) {
            pickedCoachIds.add(a.staffId);
            const reportsToId = pickReportsTo(a.role, signedCoaches);
            await deps.repo.assignCoach(a.staffId, {
              teamId: team.teamId,
              reportsToId,
              contractSalary: a.salary,
              contractYears: a.contractYears,
              contractBuyout: a.contractBuyout,
              hiredAt: now(),
            });
            signedCoaches.push({ staffId: a.staffId, role: a.role });
            const decision = await deps.repo.createDecision({
              leagueId,
              staffType: "coach",
              staffId: a.staffId,
              chosenOfferId: null,
              wave: FINALIZE_WAVE,
            });
            decisions.push(decision);
          }
          leagueSpentOnAssembly += result.spent;
        }

        // Build scouting staff under Director.
        const director = signed.find(
          (m) => m.staffType === "scout" && m.role === "DIRECTOR",
        );
        if (director) {
          const dosCtx = await deps.repo.getCandidateScoringContext(
            "scout",
            director.staffId,
          );
          const dosQuality = dosCtx ? sumPreferences(dosCtx) : 200;
          // Recompute remaining budget after coaching staff assembled.
          const remainingForScouts = league.staffBudget - signedTotalSalary -
            leagueSpentOnAssembly;
          const result = assembleScoutingStaff({
            dosQuality,
            pool: scoutPool(),
            remainingBudget: remainingForScouts,
            rng,
          });
          for (const a of result.assignments) {
            pickedScoutIds.add(a.staffId);
            await deps.repo.assignScout(a.staffId, {
              teamId: team.teamId,
              contractSalary: a.salary,
              contractYears: a.contractYears,
              contractBuyout: a.contractBuyout,
              hiredAt: now(),
            });
            const decision = await deps.repo.createDecision({
              leagueId,
              staffType: "scout",
              staffId: a.staffId,
              chosenOfferId: null,
              wave: FINALIZE_WAVE,
            });
            decisions.push(decision);
          }
          leagueSpentOnAssembly += result.spent;
        }
      }

      return { decisions };
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

    async getTeamHiringState(leagueId, teamId) {
      const league = await loadLeague(leagueId);
      const [
        interests,
        interviews,
        offers,
        decisions,
        signedTotal,
      ] = await Promise.all([
        deps.repo.listInterestsByTeam(leagueId, teamId),
        deps.repo.listInterviewsByTeam(leagueId, teamId),
        deps.repo.listOffersByTeam(leagueId, teamId),
        deps.repo.listDecisionsByLeague(leagueId),
        deps.repo.sumSignedStaffSalaries(teamId),
      ]);
      const pendingTotal = offers
        .filter((o) => o.status === "pending")
        .reduce((sum, o) => sum + o.salary, 0);
      return {
        leagueId,
        teamId,
        staffBudget: league.staffBudget,
        remainingBudget: league.staffBudget - signedTotal - pendingTotal,
        interests,
        interviews,
        offers,
        decisions,
      };
    },

    async listCandidates(leagueId, filter) {
      const [coaches, scouts] = await Promise.all([
        deps.repo.listUnassignedCoaches(leagueId),
        deps.repo.listUnassignedScouts(leagueId),
      ]);
      const all: HiringCandidateSummary[] = [];
      if (!filter?.staffType || filter.staffType === "coach") {
        for (const coach of coaches) {
          if (!LEADERSHIP_COACH_ROLES.has(coach.role)) continue;
          if (filter?.role && coach.role !== filter.role) continue;
          const archetypes = archetypeNamesFor(
            coach.role,
            coach.specialty,
            coach.id,
          );
          all.push({
            id: coach.id,
            leagueId: coach.leagueId,
            staffType: "coach",
            firstName: coach.firstName,
            lastName: coach.lastName,
            role: coach.role,
            specialty: coach.specialty,
            offensiveArchetype: archetypes.offensive,
            defensiveArchetype: archetypes.defensive,
          });
        }
      }
      if (!filter?.staffType || filter.staffType === "scout") {
        for (const scout of scouts) {
          if (!LEADERSHIP_SCOUT_ROLES.has(scout.role)) continue;
          if (filter?.role && scout.role !== filter.role) continue;
          all.push({
            id: scout.id,
            leagueId: scout.leagueId,
            staffType: "scout",
            firstName: scout.firstName,
            lastName: scout.lastName,
            role: scout.role,
            specialty: null,
            offensiveArchetype: null,
            defensiveArchetype: null,
          });
        }
      }
      return all;
    },

    async getCandidateDetail(leagueId, candidateId, viewerTeamId) {
      const [coaches, scouts] = await Promise.all([
        deps.repo.listUnassignedCoaches(leagueId),
        deps.repo.listUnassignedScouts(leagueId),
      ]);
      const coach = coaches.find((c) => c.id === candidateId);
      const scout = scouts.find((s) => s.id === candidateId);
      const hit = coach
        ? { candidate: coach, staffType: "coach" as const }
        : scout
        ? { candidate: scout, staffType: "scout" as const }
        : undefined;
      if (!hit) return undefined;

      let interviewReveal: HiringCandidateDetail["interviewReveal"] = null;
      if (viewerTeamId) {
        const interview = await deps.repo.findInterview(
          leagueId,
          viewerTeamId,
          hit.staffType,
          candidateId,
        );
        if (interview && interview.status === "completed") {
          interviewReveal = {
            philosophyReveal: interview.philosophyReveal,
            staffFitReveal: interview.staffFitReveal,
          };
        }
      }

      const archetypes = hit.staffType === "coach"
        ? archetypeNamesFor(
          hit.candidate.role,
          hit.candidate.specialty,
          hit.candidate.id,
        )
        : { offensive: null, defensive: null };
      return {
        id: hit.candidate.id,
        leagueId: hit.candidate.leagueId,
        staffType: hit.staffType,
        firstName: hit.candidate.firstName,
        lastName: hit.candidate.lastName,
        role: hit.candidate.role,
        specialty: hit.staffType === "coach" ? hit.candidate.specialty : null,
        offensiveArchetype: archetypes.offensive,
        defensiveArchetype: archetypes.defensive,
        marketTierPref: hit.candidate.marketTierPref,
        philosophyFitPref: hit.candidate.philosophyFitPref,
        staffFitPref: hit.candidate.staffFitPref,
        compensationPref: hit.candidate.compensationPref,
        minimumThreshold: hit.candidate.minimumThreshold,
        interviewReveal,
      };
    },

    async resolveCandidate(leagueId, candidateId) {
      const [coaches, scouts] = await Promise.all([
        deps.repo.listUnassignedCoaches(leagueId),
        deps.repo.listUnassignedScouts(leagueId),
      ]);
      if (coaches.some((c) => c.id === candidateId)) {
        return { staffType: "coach", staffId: candidateId };
      }
      if (scouts.some((s) => s.id === candidateId)) {
        return { staffType: "scout", staffId: candidateId };
      }
      return undefined;
    },

    async listDecisions(leagueId, wave) {
      const all = await deps.repo.listDecisionsByLeague(leagueId);
      if (wave === undefined) return all;
      return all.filter((d) => d.wave === wave);
    },
  };
}
