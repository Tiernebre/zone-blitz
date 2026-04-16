import { and, eq, isNull } from "drizzle-orm";
import type pino from "pino";
import type { Database, Executor } from "../../db/connection.ts";
import {
  hiringDecisions,
  hiringInterests,
  hiringInterviews,
  hiringOffers,
} from "./hiring.schema.ts";
import { coaches } from "../coaches/coach.schema.ts";
import { scouts } from "../scouts/scout.schema.ts";

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
  marketTierPref: number | null;
  philosophyFitPref: number | null;
  staffFitPref: number | null;
  compensationPref: number | null;
  minimumThreshold: number | null;
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
      return rows.map((r) => ({ ...r, role: r.role as string }));
    },

    async listUnassignedScouts(leagueId, tx) {
      const rows = await (tx ?? deps.db)
        .select({
          id: scouts.id,
          leagueId: scouts.leagueId,
          firstName: scouts.firstName,
          lastName: scouts.lastName,
          role: scouts.role,
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
      return rows.map((r) => ({ ...r, role: r.role as string }));
    },
  };
}
