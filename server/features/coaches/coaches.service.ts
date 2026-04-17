import { DomainError } from "@zone-blitz/shared";
import type pino from "pino";
import type { Database } from "../../db/connection.ts";
import { chunkedInsert } from "../../db/chunked-insert.ts";
import { coaches } from "./coach.schema.ts";
import type { CoachesGenerator } from "./coaches.generator.interface.ts";
import type { CoachesRepository } from "./coaches.repository.interface.ts";
import type { CoachTendenciesRepository } from "./coach-tendencies.repository.interface.ts";
import type { CoachRatingsRepository } from "./coach-ratings.repository.ts";
import type { CoachesService } from "./coaches.service.interface.ts";
import { computeFingerprint } from "../schemes/fingerprint.ts";

export function createCoachesService(deps: {
  generator: CoachesGenerator;
  repo: CoachesRepository;
  tendenciesRepo: CoachTendenciesRepository;
  ratingsRepo: CoachRatingsRepository;
  db: Database;
  log: pino.Logger;
}): CoachesService {
  const log = deps.log.child({ module: "coaches.service" });

  return {
    async generate(input, tx) {
      log.info({ leagueId: input.leagueId }, "generating coaches");

      const generated = deps.generator.generate({
        leagueId: input.leagueId,
        teamIds: input.teamIds,
      });

      if (generated.length === 0) {
        return { coachCount: 0 };
      }

      const coachRows = generated.map((
        { tendencies: _t, ratings: _r, schemeFit: _sf, ...row },
      ) => row);
      await chunkedInsert(tx ?? deps.db, coaches, coachRows);

      for (const coach of generated) {
        await deps.ratingsRepo.upsert({
          coachId: coach.id,
          current: coach.ratings.current,
          ceiling: coach.ratings.ceiling,
          growthRate: coach.ratings.growthRate,
        }, tx);
        if (!coach.tendencies) continue;
        await deps.tendenciesRepo.upsert({
          coachId: coach.id,
          ...coach.tendencies.offense,
          ...coach.tendencies.defense,
        }, tx);
      }

      log.info(
        { leagueId: input.leagueId, coaches: generated.length },
        "persisted coaches",
      );

      return { coachCount: generated.length };
    },

    async generatePool(input, tx) {
      log.info({ leagueId: input.leagueId }, "generating coaching pool");

      const generated = deps.generator.generatePool({
        leagueId: input.leagueId,
        numberOfTeams: input.numberOfTeams,
      });

      if (generated.length === 0) {
        return { coachCount: 0 };
      }

      const coachRows = generated.map((
        { tendencies: _t, ratings: _r, schemeFit: _sf, ...row },
      ) => row);
      await chunkedInsert(tx ?? deps.db, coaches, coachRows);

      for (const coach of generated) {
        await deps.ratingsRepo.upsert({
          coachId: coach.id,
          current: coach.ratings.current,
          ceiling: coach.ratings.ceiling,
          growthRate: coach.ratings.growthRate,
        }, tx);
        if (!coach.tendencies) continue;
        await deps.tendenciesRepo.upsert({
          coachId: coach.id,
          ...coach.tendencies.offense,
          ...coach.tendencies.defense,
        }, tx);
      }

      log.info(
        { leagueId: input.leagueId, coaches: generated.length },
        "persisted coaching pool",
      );

      return { coachCount: generated.length };
    },

    async getStaffTree(leagueId, teamId) {
      log.debug({ leagueId, teamId }, "fetching staff tree");
      return await deps.repo.getStaffTreeByTeam(leagueId, teamId);
    },

    async getCoachDetail(id) {
      log.debug({ id }, "fetching coach detail");
      const detail = await deps.repo.getCoachDetailById(id);
      if (!detail) {
        throw new DomainError("NOT_FOUND", `Coach ${id} not found`);
      }
      return detail;
    },

    async getFingerprint(leagueId, teamId) {
      log.debug({ leagueId, teamId }, "computing scheme fingerprint");
      const staff = await deps.repo.getStaffTreeByTeam(leagueId, teamId);
      const oc = staff.find((c) => c.role === "OC" && !c.isVacancy);
      const dc = staff.find((c) => c.role === "DC" && !c.isVacancy);
      const [ocTendencies, dcTendencies] = await Promise.all([
        oc
          ? deps.tendenciesRepo.getByCoachId(oc.id)
          : Promise.resolve(undefined),
        dc
          ? deps.tendenciesRepo.getByCoachId(dc.id)
          : Promise.resolve(undefined),
      ]);
      return computeFingerprint({
        oc: ocTendencies ?? null,
        dc: dcTendencies ?? null,
      });
    },
  };
}
