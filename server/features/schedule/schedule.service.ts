import type pino from "pino";
import type { Database } from "../../db/connection.ts";
import { games } from "./game.schema.ts";
import type { ScheduleGenerator } from "./schedule.generator.interface.ts";
import type { ScheduleService } from "./schedule.service.interface.ts";

export function createScheduleService(deps: {
  generator: ScheduleGenerator;
  db: Database;
  log: pino.Logger;
}): ScheduleService {
  const log = deps.log.child({ module: "schedule.service" });

  return {
    async generate(input, tx) {
      log.info({ seasonId: input.seasonId }, "generating schedule");

      const generatedGames = deps.generator.generate({
        seasonId: input.seasonId,
        teams: input.teams,
        seasonLength: input.seasonLength,
      });

      if (generatedGames.length > 0) {
        await (tx ?? deps.db).insert(games).values(generatedGames);
      }

      log.info(
        { seasonId: input.seasonId, games: generatedGames.length },
        "persisted schedule",
      );

      return { gameCount: generatedGames.length };
    },
  };
}
