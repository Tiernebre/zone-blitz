import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import type pino from "pino";
import type {
  CoachRole,
  DefensiveTendencies,
  OffensiveTendencies,
  ScoutRole,
} from "@zone-blitz/shared";
import type { Database, Executor } from "../../db/connection.ts";
import {
  hiringDecisions,
  hiringInterests,
  hiringInterviews,
  hiringOffers,
} from "./hiring.schema.ts";
import { coaches } from "../coaches/coach.schema.ts";
import { scouts } from "../scouts/scout.schema.ts";
import { coachTendencies } from "../coaches/coach-tendencies.schema.ts";
import { teams } from "../team/team.schema.ts";
import type { FranchiseStaffMember, MarketTier } from "./preference-scoring.ts";
import { PREFERENCE_NEUTRAL } from "./hiring-constants.ts";

export type StaffType = "coach" | "scout";
export type HiringInterestStatus = "active" | "withdrawn";
export type HiringInterviewStatus =
  | "requested"
  | "accepted"
  | "declined"
  | "completed";
export type HiringOfferStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "expired";

export interface HiringInterestRow {
  id: string;
  leagueId: string;
  teamId: string;
  staffType: StaffType;
  staffId: string;
  stepSlug: string;
  status: HiringInterestStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface HiringInterviewRow {
  id: string;
  leagueId: string;
  teamId: string;
  staffType: StaffType;
  staffId: string;
  stepSlug: string;
  status: HiringInterviewStatus;
  philosophyReveal: unknown;
  staffFitReveal: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface HiringOfferRow {
  id: string;
  leagueId: string;
  teamId: string;
  staffType: StaffType;
  staffId: string;
  stepSlug: string;
  status: HiringOfferStatus;
  salary: number;
  contractYears: number;
  buyoutMultiplier: string;
  incentives: unknown;
  preferenceScore: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface HiringDecisionRow {
  id: string;
  leagueId: string;
  staffType: StaffType;
  staffId: string;
  chosenOfferId: string | null;
  wave: number;
  decidedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UnassignedCandidate {
  id: string;
  leagueId: string;
  firstName: string;
  lastName: string;
  role: string;
  /** Coach specialty (e.g. `offense`, `defense`, `ceo`, `quarterbacks`).
   * Null when the row represents a scout. */
  specialty: string | null;
  /** Coach: the position group their career came up through. Null for
   * scouts. */
  positionBackground: string | null;
  /** Scout: the position group their evaluation work focuses on. Null
   * for coaches. */
  positionFocus: string | null;
  /** Scout: the region this scout's network is strongest in. Null for
   * coaches. */
  regionFocus: string | null;
  age: number;
  yearsExperience: number;
  /** Coach: years spent as head coach. 0 for scouts. */
  headCoachYears: number;
  /** Coach: years spent as a coordinator. 0 for scouts. */
  coordinatorYears: number;
  /** Coach: years spent as a position coach/assistant. 0 for scouts. */
  positionCoachYears: number;
  marketTierPref: number | null;
  philosophyFitPref: number | null;
  staffFitPref: number | null;
  compensationPref: number | null;
  minimumThreshold: number | null;
}

export interface CandidateScoringContext {
  staffType: StaffType;
  staffId: string;
  role: CoachRole | ScoutRole;
  preferences: {
    marketTierPref: number;
    philosophyFitPref: number;
    staffFitPref: number;
    compensationPref: number;
    minimumThreshold: number;
  };
  offense: OffensiveTendencies | null;
  defense: DefensiveTendencies | null;
}

export interface FranchiseScoringProfile {
  teamId: string;
  marketTier: MarketTier;
  existingStaff: FranchiseStaffMember[];
}

export interface SignedStaffMember {
  staffType: StaffType;
  staffId: string;
  role: CoachRole | ScoutRole;
  contractSalary: number;
}

export interface TeamScoringSummary {
  teamId: string;
  marketTier: MarketTier;
}

export interface AssignCoachPatch {
  teamId: string;
  reportsToId: string | null;
  contractSalary: number;
  contractYears: number;
  contractBuyout: number;
  hiredAt: Date;
}

export interface AssignScoutPatch {
  teamId: string;
  contractSalary: number;
  contractYears: number;
  contractBuyout: number;
  hiredAt: Date;
}

export interface HiringRepository {
  createInterest(
    input: {
      leagueId: string;
      teamId: string;
      staffType: StaffType;
      staffId: string;
      stepSlug: string;
    },
    tx?: Executor,
  ): Promise<HiringInterestRow>;
  getInterestById(
    id: string,
    tx?: Executor,
  ): Promise<HiringInterestRow | undefined>;
  listInterestsByLeague(
    leagueId: string,
    tx?: Executor,
  ): Promise<HiringInterestRow[]>;
  listInterestsByTeam(
    leagueId: string,
    teamId: string,
    tx?: Executor,
  ): Promise<HiringInterestRow[]>;
  findActiveInterest(
    leagueId: string,
    teamId: string,
    staffType: StaffType,
    staffId: string,
    tx?: Executor,
  ): Promise<HiringInterestRow | undefined>;
  updateInterestStatus(
    id: string,
    status: HiringInterestStatus,
    tx?: Executor,
  ): Promise<HiringInterestRow>;

  createInterview(
    input: {
      leagueId: string;
      teamId: string;
      staffType: StaffType;
      staffId: string;
      stepSlug: string;
    },
    tx?: Executor,
  ): Promise<HiringInterviewRow>;
  getInterviewById(
    id: string,
    tx?: Executor,
  ): Promise<HiringInterviewRow | undefined>;
  listInterviewsByLeague(
    leagueId: string,
    tx?: Executor,
  ): Promise<HiringInterviewRow[]>;
  listInterviewsByTeam(
    leagueId: string,
    teamId: string,
    tx?: Executor,
  ): Promise<HiringInterviewRow[]>;
  listInterviewsByStep(
    leagueId: string,
    stepSlug: string,
    tx?: Executor,
  ): Promise<HiringInterviewRow[]>;
  findInterview(
    leagueId: string,
    teamId: string,
    staffType: StaffType,
    staffId: string,
    tx?: Executor,
  ): Promise<HiringInterviewRow | undefined>;
  updateInterview(
    id: string,
    patch: {
      status?: HiringInterviewStatus;
      philosophyReveal?: unknown;
      staffFitReveal?: unknown;
    },
    tx?: Executor,
  ): Promise<HiringInterviewRow>;

  createOffer(
    input: {
      leagueId: string;
      teamId: string;
      staffType: StaffType;
      staffId: string;
      stepSlug: string;
      salary: number;
      contractYears: number;
      buyoutMultiplier: string;
      incentives?: unknown;
    },
    tx?: Executor,
  ): Promise<HiringOfferRow>;
  getOfferById(
    id: string,
    tx?: Executor,
  ): Promise<HiringOfferRow | undefined>;
  listOffersByLeague(
    leagueId: string,
    tx?: Executor,
  ): Promise<HiringOfferRow[]>;
  listOffersByTeam(
    leagueId: string,
    teamId: string,
    tx?: Executor,
  ): Promise<HiringOfferRow[]>;
  listPendingOffersByLeague(
    leagueId: string,
    tx?: Executor,
  ): Promise<HiringOfferRow[]>;
  updateOffer(
    id: string,
    patch: {
      status?: HiringOfferStatus;
      preferenceScore?: number | null;
    },
    tx?: Executor,
  ): Promise<HiringOfferRow>;

  createDecision(
    input: {
      leagueId: string;
      staffType: StaffType;
      staffId: string;
      chosenOfferId: string | null;
      wave: number;
    },
    tx?: Executor,
  ): Promise<HiringDecisionRow>;
  listDecisionsByLeague(
    leagueId: string,
    tx?: Executor,
  ): Promise<HiringDecisionRow[]>;

  listUnassignedCoaches(
    leagueId: string,
    tx?: Executor,
  ): Promise<UnassignedCandidate[]>;
  listUnassignedScouts(
    leagueId: string,
    tx?: Executor,
  ): Promise<UnassignedCandidate[]>;

  getCandidateScoringContext(
    staffType: StaffType,
    staffId: string,
    tx?: Executor,
  ): Promise<CandidateScoringContext | undefined>;
  getFranchiseScoringProfile(
    teamId: string,
    tx?: Executor,
  ): Promise<FranchiseScoringProfile | undefined>;
  sumSignedStaffSalaries(teamId: string, tx?: Executor): Promise<number>;
  listTeamsForLeague(
    leagueId: string,
    tx?: Executor,
  ): Promise<TeamScoringSummary[]>;
  listSignedStaffByTeam(
    leagueId: string,
    teamId: string,
    tx?: Executor,
  ): Promise<SignedStaffMember[]>;

  assignCoach(
    coachId: string,
    patch: AssignCoachPatch,
    tx?: Executor,
  ): Promise<void>;
  assignScout(
    scoutId: string,
    patch: AssignScoutPatch,
    tx?: Executor,
  ): Promise<void>;
}

export function createHiringRepository(deps: {
  db: Database;
  log: pino.Logger;
}): HiringRepository {
  const log = deps.log.child({ module: "hiring.repository" });

  return {
    async createInterest(input, tx) {
      log.debug(
        { leagueId: input.leagueId, teamId: input.teamId },
        "creating hiring interest",
      );
      const [row] = await (tx ?? deps.db)
        .insert(hiringInterests)
        .values({
          leagueId: input.leagueId,
          teamId: input.teamId,
          staffType: input.staffType,
          staffId: input.staffId,
          stepSlug: input.stepSlug,
        })
        .returning();
      return row;
    },

    async getInterestById(id, tx) {
      const [row] = await (tx ?? deps.db)
        .select()
        .from(hiringInterests)
        .where(eq(hiringInterests.id, id))
        .limit(1);
      return row ?? undefined;
    },

    async listInterestsByLeague(leagueId, tx) {
      return await (tx ?? deps.db)
        .select()
        .from(hiringInterests)
        .where(eq(hiringInterests.leagueId, leagueId));
    },

    async listInterestsByTeam(leagueId, teamId, tx) {
      return await (tx ?? deps.db)
        .select()
        .from(hiringInterests)
        .where(
          and(
            eq(hiringInterests.leagueId, leagueId),
            eq(hiringInterests.teamId, teamId),
          ),
        );
    },

    async findActiveInterest(leagueId, teamId, staffType, staffId, tx) {
      const [row] = await (tx ?? deps.db)
        .select()
        .from(hiringInterests)
        .where(
          and(
            eq(hiringInterests.leagueId, leagueId),
            eq(hiringInterests.teamId, teamId),
            eq(hiringInterests.staffType, staffType),
            eq(hiringInterests.staffId, staffId),
            eq(hiringInterests.status, "active"),
          ),
        )
        .limit(1);
      return row ?? undefined;
    },

    async updateInterestStatus(id, status, tx) {
      const [row] = await (tx ?? deps.db)
        .update(hiringInterests)
        .set({ status, updatedAt: new Date() })
        .where(eq(hiringInterests.id, id))
        .returning();
      return row;
    },

    async createInterview(input, tx) {
      log.debug(
        { leagueId: input.leagueId, teamId: input.teamId },
        "creating hiring interview",
      );
      const [row] = await (tx ?? deps.db)
        .insert(hiringInterviews)
        .values({
          leagueId: input.leagueId,
          teamId: input.teamId,
          staffType: input.staffType,
          staffId: input.staffId,
          stepSlug: input.stepSlug,
        })
        .returning();
      return row;
    },

    async getInterviewById(id, tx) {
      const [row] = await (tx ?? deps.db)
        .select()
        .from(hiringInterviews)
        .where(eq(hiringInterviews.id, id))
        .limit(1);
      return row ?? undefined;
    },

    async listInterviewsByLeague(leagueId, tx) {
      return await (tx ?? deps.db)
        .select()
        .from(hiringInterviews)
        .where(eq(hiringInterviews.leagueId, leagueId));
    },

    async listInterviewsByTeam(leagueId, teamId, tx) {
      return await (tx ?? deps.db)
        .select()
        .from(hiringInterviews)
        .where(
          and(
            eq(hiringInterviews.leagueId, leagueId),
            eq(hiringInterviews.teamId, teamId),
          ),
        );
    },

    async listInterviewsByStep(leagueId, stepSlug, tx) {
      return await (tx ?? deps.db)
        .select()
        .from(hiringInterviews)
        .where(
          and(
            eq(hiringInterviews.leagueId, leagueId),
            eq(hiringInterviews.stepSlug, stepSlug),
          ),
        );
    },

    async findInterview(leagueId, teamId, staffType, staffId, tx) {
      const [row] = await (tx ?? deps.db)
        .select()
        .from(hiringInterviews)
        .where(
          and(
            eq(hiringInterviews.leagueId, leagueId),
            eq(hiringInterviews.teamId, teamId),
            eq(hiringInterviews.staffType, staffType),
            eq(hiringInterviews.staffId, staffId),
          ),
        )
        .limit(1);
      return row ?? undefined;
    },

    async updateInterview(id, patch, tx) {
      const set: Record<string, unknown> = { updatedAt: new Date() };
      if (patch.status !== undefined) set.status = patch.status;
      if (patch.philosophyReveal !== undefined) {
        set.philosophyReveal = patch.philosophyReveal;
      }
      if (patch.staffFitReveal !== undefined) {
        set.staffFitReveal = patch.staffFitReveal;
      }
      const [row] = await (tx ?? deps.db)
        .update(hiringInterviews)
        .set(set)
        .where(eq(hiringInterviews.id, id))
        .returning();
      return row;
    },

    async createOffer(input, tx) {
      log.debug(
        { leagueId: input.leagueId, teamId: input.teamId },
        "creating hiring offer",
      );
      const [row] = await (tx ?? deps.db)
        .insert(hiringOffers)
        .values({
          leagueId: input.leagueId,
          teamId: input.teamId,
          staffType: input.staffType,
          staffId: input.staffId,
          stepSlug: input.stepSlug,
          salary: input.salary,
          contractYears: input.contractYears,
          buyoutMultiplier: input.buyoutMultiplier,
          ...(input.incentives !== undefined
            ? { incentives: input.incentives }
            : {}),
        })
        .returning();
      return row;
    },

    async getOfferById(id, tx) {
      const [row] = await (tx ?? deps.db)
        .select()
        .from(hiringOffers)
        .where(eq(hiringOffers.id, id))
        .limit(1);
      return row ?? undefined;
    },

    async listOffersByLeague(leagueId, tx) {
      return await (tx ?? deps.db)
        .select()
        .from(hiringOffers)
        .where(eq(hiringOffers.leagueId, leagueId));
    },

    async listOffersByTeam(leagueId, teamId, tx) {
      return await (tx ?? deps.db)
        .select()
        .from(hiringOffers)
        .where(
          and(
            eq(hiringOffers.leagueId, leagueId),
            eq(hiringOffers.teamId, teamId),
          ),
        );
    },

    async listPendingOffersByLeague(leagueId, tx) {
      return await (tx ?? deps.db)
        .select()
        .from(hiringOffers)
        .where(
          and(
            eq(hiringOffers.leagueId, leagueId),
            eq(hiringOffers.status, "pending"),
          ),
        );
    },

    async updateOffer(id, patch, tx) {
      const set: Record<string, unknown> = { updatedAt: new Date() };
      if (patch.status !== undefined) set.status = patch.status;
      if (patch.preferenceScore !== undefined) {
        set.preferenceScore = patch.preferenceScore;
      }
      const [row] = await (tx ?? deps.db)
        .update(hiringOffers)
        .set(set)
        .where(eq(hiringOffers.id, id))
        .returning();
      return row;
    },

    async createDecision(input, tx) {
      log.debug(
        { leagueId: input.leagueId, wave: input.wave },
        "creating hiring decision",
      );
      const [row] = await (tx ?? deps.db)
        .insert(hiringDecisions)
        .values({
          leagueId: input.leagueId,
          staffType: input.staffType,
          staffId: input.staffId,
          chosenOfferId: input.chosenOfferId,
          wave: input.wave,
        })
        .returning();
      return row;
    },

    async listDecisionsByLeague(leagueId, tx) {
      return await (tx ?? deps.db)
        .select()
        .from(hiringDecisions)
        .where(eq(hiringDecisions.leagueId, leagueId));
    },

    async listUnassignedCoaches(leagueId, tx) {
      const rows = await (tx ?? deps.db)
        .select({
          id: coaches.id,
          leagueId: coaches.leagueId,
          firstName: coaches.firstName,
          lastName: coaches.lastName,
          role: coaches.role,
          specialty: coaches.specialty,
          positionBackground: coaches.positionBackground,
          age: coaches.age,
          yearsExperience: coaches.yearsExperience,
          headCoachYears: coaches.headCoachYears,
          coordinatorYears: coaches.coordinatorYears,
          positionCoachYears: coaches.positionCoachYears,
          marketTierPref: coaches.marketTierPref,
          philosophyFitPref: coaches.philosophyFitPref,
          staffFitPref: coaches.staffFitPref,
          compensationPref: coaches.compensationPref,
          minimumThreshold: coaches.minimumThreshold,
        })
        .from(coaches)
        .where(
          and(eq(coaches.leagueId, leagueId), isNull(coaches.teamId)),
        );
      return rows.map((r) => ({
        ...r,
        role: r.role as string,
        specialty: (r.specialty as string | null) ?? null,
        positionBackground: (r.positionBackground as string | null) ?? null,
        positionFocus: null as string | null,
        regionFocus: null as string | null,
        headCoachYears: (r.headCoachYears as number | null) ?? 0,
        coordinatorYears: (r.coordinatorYears as number | null) ?? 0,
        positionCoachYears: (r.positionCoachYears as number | null) ?? 0,
      }));
    },

    async listUnassignedScouts(leagueId, tx) {
      const rows = await (tx ?? deps.db)
        .select({
          id: scouts.id,
          leagueId: scouts.leagueId,
          firstName: scouts.firstName,
          lastName: scouts.lastName,
          role: scouts.role,
          positionFocus: scouts.positionFocus,
          regionFocus: scouts.regionFocus,
          age: scouts.age,
          yearsExperience: scouts.yearsExperience,
          marketTierPref: scouts.marketTierPref,
          philosophyFitPref: scouts.philosophyFitPref,
          staffFitPref: scouts.staffFitPref,
          compensationPref: scouts.compensationPref,
          minimumThreshold: scouts.minimumThreshold,
        })
        .from(scouts)
        .where(
          and(eq(scouts.leagueId, leagueId), isNull(scouts.teamId)),
        );
      return rows.map((r) => ({
        ...r,
        role: r.role as string,
        specialty: null as string | null,
        positionBackground: null as string | null,
        positionFocus: (r.positionFocus as string | null) ?? null,
        regionFocus: (r.regionFocus as string | null) ?? null,
        headCoachYears: 0,
        coordinatorYears: 0,
        positionCoachYears: 0,
      }));
    },

    async getCandidateScoringContext(staffType, staffId, tx) {
      const exec = tx ?? deps.db;
      if (staffType === "coach") {
        const [row] = await exec
          .select({
            id: coaches.id,
            role: coaches.role,
            marketTierPref: coaches.marketTierPref,
            philosophyFitPref: coaches.philosophyFitPref,
            staffFitPref: coaches.staffFitPref,
            compensationPref: coaches.compensationPref,
            minimumThreshold: coaches.minimumThreshold,
          })
          .from(coaches)
          .where(eq(coaches.id, staffId))
          .limit(1);
        if (!row) return undefined;
        const tendencies = await exec
          .select()
          .from(coachTendencies)
          .where(eq(coachTendencies.coachId, staffId))
          .limit(1);
        const tendRow = tendencies[0];
        const offense = tendRow && tendRow.runPassLean !== null
          ? {
            runPassLean: tendRow.runPassLean ?? 0,
            tempo: tendRow.tempo ?? 0,
            personnelWeight: tendRow.personnelWeight ?? 0,
            formationUnderCenterShotgun: tendRow.formationUnderCenterShotgun ??
              0,
            preSnapMotionRate: tendRow.preSnapMotionRate ?? 0,
            passingStyle: tendRow.passingStyle ?? 0,
            passingDepth: tendRow.passingDepth ?? 0,
            runGameBlocking: tendRow.runGameBlocking ?? 0,
            rpoIntegration: tendRow.rpoIntegration ?? 0,
          } as OffensiveTendencies
          : null;
        const defense = tendRow && tendRow.frontOddEven !== null
          ? {
            frontOddEven: tendRow.frontOddEven ?? 0,
            gapResponsibility: tendRow.gapResponsibility ?? 0,
            subPackageLean: tendRow.subPackageLean ?? 0,
            coverageManZone: tendRow.coverageManZone ?? 0,
            coverageShell: tendRow.coverageShell ?? 0,
            cornerPressOff: tendRow.cornerPressOff ?? 0,
            pressureRate: tendRow.pressureRate ?? 0,
            disguiseRate: tendRow.disguiseRate ?? 0,
          } as DefensiveTendencies
          : null;
        return {
          staffType: "coach",
          staffId,
          role: row.role as CoachRole,
          preferences: {
            marketTierPref: row.marketTierPref ?? PREFERENCE_NEUTRAL,
            philosophyFitPref: row.philosophyFitPref ?? PREFERENCE_NEUTRAL,
            staffFitPref: row.staffFitPref ?? PREFERENCE_NEUTRAL,
            compensationPref: row.compensationPref ?? PREFERENCE_NEUTRAL,
            minimumThreshold: row.minimumThreshold ?? PREFERENCE_NEUTRAL,
          },
          offense,
          defense,
        };
      }

      const [row] = await exec
        .select({
          id: scouts.id,
          role: scouts.role,
          marketTierPref: scouts.marketTierPref,
          philosophyFitPref: scouts.philosophyFitPref,
          staffFitPref: scouts.staffFitPref,
          compensationPref: scouts.compensationPref,
          minimumThreshold: scouts.minimumThreshold,
        })
        .from(scouts)
        .where(eq(scouts.id, staffId))
        .limit(1);
      if (!row) return undefined;
      return {
        staffType: "scout",
        staffId,
        role: row.role as ScoutRole,
        preferences: {
          marketTierPref: row.marketTierPref ?? PREFERENCE_NEUTRAL,
          philosophyFitPref: row.philosophyFitPref ?? PREFERENCE_NEUTRAL,
          staffFitPref: row.staffFitPref ?? PREFERENCE_NEUTRAL,
          compensationPref: row.compensationPref ?? PREFERENCE_NEUTRAL,
          minimumThreshold: row.minimumThreshold ?? PREFERENCE_NEUTRAL,
        },
        offense: null,
        defense: null,
      };
    },

    async getFranchiseScoringProfile(teamId, tx) {
      const exec = tx ?? deps.db;
      const [team] = await exec
        .select({ id: teams.id, marketTier: teams.marketTier })
        .from(teams)
        .where(eq(teams.id, teamId))
        .limit(1);
      if (!team) return undefined;
      const marketTier = team.marketTier;

      const coachRows = await exec
        .select({
          id: coaches.id,
          role: coaches.role,
        })
        .from(coaches)
        .where(eq(coaches.teamId, teamId));

      const tendencyRows = coachRows.length === 0 ? [] : await exec
        .select()
        .from(coachTendencies)
        .where(
          inArray(
            coachTendencies.coachId,
            coachRows.map((c) => c.id),
          ),
        );
      const tendencyById = new Map(
        tendencyRows.map((row) => [row.coachId, row]),
      );

      const existingStaff: FranchiseStaffMember[] = coachRows.map((coach) => {
        const tend = tendencyById.get(coach.id);
        const offense = tend && tend.runPassLean !== null
          ? {
            runPassLean: tend.runPassLean ?? 0,
            tempo: tend.tempo ?? 0,
            personnelWeight: tend.personnelWeight ?? 0,
            formationUnderCenterShotgun: tend.formationUnderCenterShotgun ?? 0,
            preSnapMotionRate: tend.preSnapMotionRate ?? 0,
            passingStyle: tend.passingStyle ?? 0,
            passingDepth: tend.passingDepth ?? 0,
            runGameBlocking: tend.runGameBlocking ?? 0,
            rpoIntegration: tend.rpoIntegration ?? 0,
          } as OffensiveTendencies
          : null;
        const defense = tend && tend.frontOddEven !== null
          ? {
            frontOddEven: tend.frontOddEven ?? 0,
            gapResponsibility: tend.gapResponsibility ?? 0,
            subPackageLean: tend.subPackageLean ?? 0,
            coverageManZone: tend.coverageManZone ?? 0,
            coverageShell: tend.coverageShell ?? 0,
            cornerPressOff: tend.cornerPressOff ?? 0,
            pressureRate: tend.pressureRate ?? 0,
            disguiseRate: tend.disguiseRate ?? 0,
          } as DefensiveTendencies
          : null;
        return {
          staffType: "coach",
          role: coach.role as CoachRole,
          offense,
          defense,
        };
      });

      return { teamId, marketTier, existingStaff };
    },

    async sumSignedStaffSalaries(teamId, tx) {
      const exec = tx ?? deps.db;
      const [coachSum] = await exec
        .select({
          total: sql<number>`coalesce(sum(${coaches.contractSalary}), 0)`
            .as("total"),
        })
        .from(coaches)
        .where(eq(coaches.teamId, teamId));
      const [scoutSum] = await exec
        .select({
          total: sql<number>`coalesce(sum(${scouts.contractSalary}), 0)`.as(
            "total",
          ),
        })
        .from(scouts)
        .where(eq(scouts.teamId, teamId));
      return Number(coachSum?.total ?? 0) + Number(scoutSum?.total ?? 0);
    },

    async listTeamsForLeague(leagueId, tx) {
      const exec = tx ?? deps.db;
      const rows = await exec
        .select({
          teamId: teams.id,
          marketTier: teams.marketTier,
        })
        .from(teams)
        .where(eq(teams.leagueId, leagueId));
      return rows.map((row) => ({
        teamId: row.teamId,
        marketTier: row.marketTier,
      }));
    },

    async listSignedStaffByTeam(leagueId, teamId, tx) {
      const exec = tx ?? deps.db;
      const coachRows = await exec
        .select({
          id: coaches.id,
          role: coaches.role,
          contractSalary: coaches.contractSalary,
        })
        .from(coaches)
        .where(
          and(
            eq(coaches.leagueId, leagueId),
            eq(coaches.teamId, teamId),
            isNotNull(coaches.teamId),
          ),
        );
      const scoutRows = await exec
        .select({
          id: scouts.id,
          role: scouts.role,
          contractSalary: scouts.contractSalary,
        })
        .from(scouts)
        .where(
          and(
            eq(scouts.leagueId, leagueId),
            eq(scouts.teamId, teamId),
            isNotNull(scouts.teamId),
          ),
        );
      const result: SignedStaffMember[] = [];
      for (const row of coachRows) {
        result.push({
          staffType: "coach",
          staffId: row.id,
          role: row.role as CoachRole,
          contractSalary: row.contractSalary,
        });
      }
      for (const row of scoutRows) {
        result.push({
          staffType: "scout",
          staffId: row.id,
          role: row.role as ScoutRole,
          contractSalary: row.contractSalary,
        });
      }
      return result;
    },

    async assignCoach(coachId, patch, tx) {
      log.debug({ coachId, teamId: patch.teamId }, "assigning coach");
      await (tx ?? deps.db)
        .update(coaches)
        .set({
          teamId: patch.teamId,
          reportsToId: patch.reportsToId,
          contractSalary: patch.contractSalary,
          contractYears: patch.contractYears,
          contractBuyout: patch.contractBuyout,
          hiredAt: patch.hiredAt,
          updatedAt: new Date(),
        })
        .where(eq(coaches.id, coachId));
    },

    async assignScout(scoutId, patch, tx) {
      log.debug({ scoutId, teamId: patch.teamId }, "assigning scout");
      await (tx ?? deps.db)
        .update(scouts)
        .set({
          teamId: patch.teamId,
          contractSalary: patch.contractSalary,
          contractYears: patch.contractYears,
          contractBuyout: patch.contractBuyout,
          hiredAt: patch.hiredAt,
          updatedAt: new Date(),
        })
        .where(eq(scouts.id, scoutId));
    },
  };
}
