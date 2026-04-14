import { DomainError } from "@zone-blitz/shared";
import type pino from "pino";
import type { Database } from "../../db/connection.ts";
import { chunkedInsert } from "../../db/chunked-insert.ts";
import { coaches } from "./coach.schema.ts";
import type { CoachesGenerator } from "./coaches.generator.interface.ts";
import type { CoachesRepository } from "./coaches.repository.interface.ts";
import type { CoachesService } from "./coaches.service.interface.ts";

export function createCoachesService(deps: {
  generator: CoachesGenerator;
  repo: CoachesRepository;
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

      if (generated.length > 0) {
        await chunkedInsert(tx ?? deps.db, coaches, generated);
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
