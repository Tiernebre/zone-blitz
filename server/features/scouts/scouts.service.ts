import { DomainError } from "@zone-blitz/shared";
import type pino from "pino";
import type { Database } from "../../db/connection.ts";
import { chunkedInsert } from "../../db/chunked-insert.ts";
import { scouts } from "./scout.schema.ts";
import type { ScoutsGenerator } from "./scouts.generator.interface.ts";
import type { ScoutsRepository } from "./scouts.repository.interface.ts";
import type { ScoutsService } from "./scouts.service.interface.ts";

export function createScoutsService(deps: {
  generator: ScoutsGenerator;
  repo: ScoutsRepository;
  db: Database;
  log: pino.Logger;
}): ScoutsService {
  const log = deps.log.child({ module: "scouts.service" });

  return {
    async generate(input, tx) {
      log.info({ leagueId: input.leagueId }, "generating scouts");

      const generated = deps.generator.generate({
        leagueId: input.leagueId,
        teamIds: input.teamIds,
      });

      if (generated.length > 0) {
        await chunkedInsert(tx ?? deps.db, scouts, generated);
      }

      log.info(
        { leagueId: input.leagueId, scouts: generated.length },
        "persisted scouts",
      );

      return { scoutCount: generated.length };
    },

    async getStaffTree(leagueId, teamId) {
      log.debug({ leagueId, teamId }, "fetching staff tree");
      return await deps.repo.getStaffTreeByTeam(leagueId, teamId);
    },

    async getScoutDetail(id) {
      log.debug({ id }, "fetching scout detail");
      const detail = await deps.repo.getScoutDetailById(id);
      if (!detail) {
        throw new DomainError("NOT_FOUND", `Scout ${id} not found`);
      }
      return detail;
    },
  };
}
