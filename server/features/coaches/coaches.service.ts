import { DomainError } from "@zone-blitz/shared";
import type pino from "pino";
import type { Database } from "../../db/connection.ts";
import { chunkedInsert } from "../../db/chunked-insert.ts";
import { coaches } from "./coach.schema.ts";
import type { CoachesGenerator } from "./coaches.generator.interface.ts";
import type { CoachesRepository } from "./coaches.repository.interface.ts";
import type { CoachTendenciesRepository } from "./coach-tendencies.repository.interface.ts";
import type { CoachesService } from "./coaches.service.interface.ts";

export function createCoachesService(deps: {
  generator: CoachesGenerator;
  repo: CoachesRepository;
  tendenciesRepo: CoachTendenciesRepository;
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

      const coachRows = generated.map(({ tendencies: _t, ...row }) => row);
      await chunkedInsert(tx ?? deps.db, coaches, coachRows);

      for (const coach of generated) {
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
  };
}
