import { DomainError } from "@zone-blitz/shared";
import type pino from "pino";
import type { Database } from "../../db/connection.ts";
import { chunkedInsert } from "../../db/chunked-insert.ts";
import { scouts } from "./scout.schema.ts";
import type { ScoutsGenerator } from "./scouts.generator.interface.ts";
import type { ScoutsRepository } from "./scouts.repository.interface.ts";
import type { ScoutRatingsRepository } from "./scout-ratings.repository.ts";
import type { ScoutsService } from "./scouts.service.interface.ts";

export function createScoutsService(deps: {
  generator: ScoutsGenerator;
  repo: ScoutsRepository;
  ratingsRepo: ScoutRatingsRepository;
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
        const scoutRows = generated.map(
          ({ ratings: _r, personality: _p, ...row }) => row,
        );
        await chunkedInsert(tx ?? deps.db, scouts, scoutRows);
        for (const scout of generated) {
          await deps.ratingsRepo.upsert({
            scoutId: scout.id,
            current: scout.ratings.current,
            ceiling: scout.ratings.ceiling,
            growthRate: scout.ratings.growthRate,
          }, tx);
        }
      }

      log.info(
        { leagueId: input.leagueId, scouts: generated.length },
        "persisted scouts",
      );

      return { scoutCount: generated.length };
    },

    async generatePool(input, tx) {
      log.info({ leagueId: input.leagueId }, "generating scouting pool");

      const generated = deps.generator.generatePool({
        leagueId: input.leagueId,
        numberOfTeams: input.numberOfTeams,
      });

      if (generated.length > 0) {
        const scoutRows = generated.map(
          ({ ratings: _r, personality: _p, ...row }) => row,
        );
        await chunkedInsert(tx ?? deps.db, scouts, scoutRows);
        for (const scout of generated) {
          await deps.ratingsRepo.upsert({
            scoutId: scout.id,
            current: scout.ratings.current,
            ceiling: scout.ratings.ceiling,
            growthRate: scout.ratings.growthRate,
          }, tx);
        }
      }

      log.info(
        { leagueId: input.leagueId, scouts: generated.length },
        "persisted scouting pool",
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
