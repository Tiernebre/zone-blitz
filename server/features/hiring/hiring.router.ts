import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  DomainError,
  expressInterestsSchema,
  listCandidatesQuerySchema,
  requestInterviewsSchema,
  submitOffersSchema,
} from "@zone-blitz/shared";
import type {
  DraftOffer,
  HiringLeagueRepository,
  HiringService,
} from "./hiring.service.ts";
import type { LeagueClockService } from "../league-clock/league-clock.service.ts";
import type { AppEnv } from "../../env.ts";

export interface HiringRouterDeps {
  leagueRepo: HiringLeagueRepository;
  leagueClockService: Pick<LeagueClockService, "getClockState">;
}

async function resolveActorTeamId(
  leagueId: string,
  deps: HiringRouterDeps,
): Promise<string> {
  const league = await deps.leagueRepo.getById(leagueId);
  if (!league) {
    throw new DomainError("NOT_FOUND", `League ${leagueId} not found`);
  }
  if (!league.userTeamId) {
    throw new DomainError(
      "FORBIDDEN",
      `League ${leagueId} has no user team assigned`,
    );
  }
  return league.userTeamId;
}

async function resolveHiringStepSlug(
  leagueId: string,
  deps: HiringRouterDeps,
): Promise<string> {
  const state = await deps.leagueClockService.getClockState(leagueId);
  if (!state.slug.startsWith("hiring_")) {
    throw new DomainError(
      "INVALID_STEP",
      `Current step ${state.slug} is not a hiring step`,
    );
  }
  return state.slug;
}

export function createHiringRouter(
  service: HiringService,
  deps: HiringRouterDeps,
) {
  return new Hono<AppEnv>()
    .onError((err, c) => {
      if (err instanceof DomainError) {
        return c.json({ error: err.code, message: err.message }, 400);
      }
      throw err;
    })
    .get(
      "/:leagueId/hiring/candidates",
      zValidator("query", listCandidatesQuerySchema),
      async (c) => {
        const filter = c.req.valid("query");
        const candidates = await service.listCandidates(
          c.req.param("leagueId"),
          filter,
        );
        return c.json(candidates);
      },
    )
    .get("/:leagueId/hiring/candidates/:candidateId", async (c) => {
      const leagueId = c.req.param("leagueId");
      const candidateId = c.req.param("candidateId");
      const league = await deps.leagueRepo.getById(leagueId);
      const viewerTeamId = league?.userTeamId ?? undefined;
      const detail = await service.getCandidateDetail(
        leagueId,
        candidateId,
        viewerTeamId,
      );
      if (!detail) {
        return c.json({ error: "NOT_FOUND" }, 404);
      }
      return c.json(detail);
    })
    .get("/:leagueId/hiring/state", async (c) => {
      const leagueId = c.req.param("leagueId");
      const teamId = await resolveActorTeamId(leagueId, deps);
      const state = await service.getTeamHiringState(leagueId, teamId);
      return c.json(state);
    })
    .post(
      "/:leagueId/hiring/interests",
      zValidator("json", expressInterestsSchema),
      async (c) => {
        const leagueId = c.req.param("leagueId");
        const teamId = await resolveActorTeamId(leagueId, deps);
        const stepSlug = await resolveHiringStepSlug(leagueId, deps);
        const { candidateIds } = c.req.valid("json");
        const created = [];
        for (const candidateId of candidateIds) {
          const resolved = await service.resolveCandidate(
            leagueId,
            candidateId,
          );
          if (!resolved) {
            throw new DomainError(
              "INVALID_CANDIDATE",
              `Candidate ${candidateId} is not in the unassigned pool`,
            );
          }
          const row = await service.expressInterest({
            leagueId,
            teamId,
            staffType: resolved.staffType,
            staffId: resolved.staffId,
            stepSlug,
          });
          created.push(row);
        }
        return c.json(created, 201);
      },
    )
    .post(
      "/:leagueId/hiring/interviews",
      zValidator("json", requestInterviewsSchema),
      async (c) => {
        const leagueId = c.req.param("leagueId");
        const teamId = await resolveActorTeamId(leagueId, deps);
        const stepSlug = await resolveHiringStepSlug(leagueId, deps);
        const { candidateIds } = c.req.valid("json");
        const targets = [];
        for (const candidateId of candidateIds) {
          const resolved = await service.resolveCandidate(
            leagueId,
            candidateId,
          );
          if (!resolved) {
            throw new DomainError(
              "INVALID_CANDIDATE",
              `Candidate ${candidateId} is not in the unassigned pool`,
            );
          }
          targets.push(resolved);
        }
        const rows = await service.requestInterviews({
          leagueId,
          teamId,
          stepSlug,
          targets,
        });
        return c.json(rows, 201);
      },
    )
    .post(
      "/:leagueId/hiring/offers",
      zValidator("json", submitOffersSchema),
      async (c) => {
        const leagueId = c.req.param("leagueId");
        const teamId = await resolveActorTeamId(leagueId, deps);
        const stepSlug = await resolveHiringStepSlug(leagueId, deps);
        const { offers } = c.req.valid("json");
        const drafts: DraftOffer[] = [];
        for (const offer of offers) {
          const resolved = await service.resolveCandidate(
            leagueId,
            offer.candidateId,
          );
          if (!resolved) {
            throw new DomainError(
              "INVALID_CANDIDATE",
              `Candidate ${offer.candidateId} is not in the unassigned pool`,
            );
          }
          drafts.push({
            staffType: resolved.staffType,
            staffId: resolved.staffId,
            salary: offer.salary,
            contractYears: offer.contractYears,
            buyoutMultiplier: offer.buyoutMultiplier,
            incentives: offer.incentives,
          });
        }
        const rows = await service.submitOffers({
          leagueId,
          teamId,
          stepSlug,
          offers: drafts,
        });
        return c.json(rows, 201);
      },
    )
    .get("/:leagueId/hiring/decisions", async (c) => {
      const leagueId = c.req.param("leagueId");
      const waveParam = c.req.query("wave");
      const wave = waveParam !== undefined ? Number(waveParam) : undefined;
      const decisions = await service.listDecisions(leagueId, wave);
      return c.json(decisions);
    });
}
