import type pino from "pino";
import type { Database } from "../../db/connection.ts";
import { scouts } from "./scout.schema.ts";
import type { ScoutsGenerator } from "./scouts.generator.interface.ts";
import type { ScoutsService } from "./scouts.service.interface.ts";

export function createScoutsService(deps: {
  generator: ScoutsGenerator;
  db: Database;
  log: pino.Logger;
}): ScoutsService {
  const log = deps.log.child({ module: "scouts.service" });

  return {
    async generate(input) {
      log.info({ leagueId: input.leagueId }, "generating scouts");

      const generated = deps.generator.generate({
        leagueId: input.leagueId,
        teamIds: input.teamIds,
      });

      if (generated.length > 0) {
        await deps.db.insert(scouts).values(generated);
      }

      log.info(
        { leagueId: input.leagueId, scouts: generated.length },
        "persisted scouts",
      );

      return { scoutCount: generated.length };
    },
  };
}
