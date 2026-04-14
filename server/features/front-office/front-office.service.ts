import type pino from "pino";
import type { Database } from "../../db/connection.ts";
import { frontOfficeStaff } from "./front-office.schema.ts";
import type { FrontOfficeGenerator } from "./front-office.generator.interface.ts";
import type { FrontOfficeService } from "./front-office.service.interface.ts";

export function createFrontOfficeService(deps: {
  generator: FrontOfficeGenerator;
  db: Database;
  log: pino.Logger;
}): FrontOfficeService {
  const log = deps.log.child({ module: "front-office.service" });

  return {
    async generate(input, tx) {
      log.info({ leagueId: input.leagueId }, "generating front office staff");

      const generated = deps.generator.generate({
        leagueId: input.leagueId,
        teamIds: input.teamIds,
      });

      if (generated.length > 0) {
        await (tx ?? deps.db).insert(frontOfficeStaff).values(generated);
      }

      log.info(
        { leagueId: input.leagueId, frontOffice: generated.length },
        "persisted front office staff",
      );

      return { frontOfficeCount: generated.length };
    },
  };
}
