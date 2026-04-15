import { eq } from "drizzle-orm";
import type { Executor } from "../../db/connection.ts";
import type { Database } from "../../db/connection.ts";
import { leagueClock } from "./league-clock.schema.ts";
import type { Blocker } from "./gates.ts";
import type pino from "pino";

export interface LeagueClockRow {
  leagueId: string;
  seasonYear: number;
  phase: string;
  stepIndex: number;
  advancedAt: Date;
  advancedByUserId: string | null;
  overrideReason: string | null;
  overrideBlockers: unknown;
}

export interface LeagueClockRepository {
  getByLeagueId(
    leagueId: string,
    tx?: Executor,
  ): Promise<LeagueClockRow | undefined>;

  upsert(
    row: {
      leagueId: string;
      seasonYear: number;
      phase: string;
      stepIndex: number;
      advancedByUserId: string | null;
      overrideReason?: string | null;
      overrideBlockers?: Blocker[] | null;
    },
    tx?: Executor,
  ): Promise<LeagueClockRow>;
}

export function createLeagueClockRepository(deps: {
  db: Database;
  log: pino.Logger;
}): LeagueClockRepository {
  const log = deps.log.child({ module: "league-clock.repository" });

  return {
    async getByLeagueId(leagueId, tx) {
      log.debug({ leagueId }, "fetching league clock");
      const [row] = await (tx ?? deps.db)
        .select()
        .from(leagueClock)
        .where(eq(leagueClock.leagueId, leagueId))
        .limit(1);
      return row ?? undefined;
    },

    async upsert(row, tx) {
      log.debug(
        { leagueId: row.leagueId, phase: row.phase, stepIndex: row.stepIndex },
        "upserting league clock",
      );
      const values = {
        leagueId: row.leagueId,
        seasonYear: row.seasonYear,
        phase: row.phase as typeof leagueClock.$inferInsert.phase,
        stepIndex: row.stepIndex,
        advancedAt: new Date(),
        advancedByUserId: row.advancedByUserId,
        overrideReason: row.overrideReason ?? null,
        overrideBlockers: row.overrideBlockers ?? null,
      };

      const [result] = await (tx ?? deps.db)
        .insert(leagueClock)
        .values(values)
        .onConflictDoUpdate({
          target: leagueClock.leagueId,
          set: {
            seasonYear: values.seasonYear,
            phase: values.phase,
            stepIndex: values.stepIndex,
            advancedAt: values.advancedAt,
            advancedByUserId: values.advancedByUserId,
            overrideReason: values.overrideReason,
            overrideBlockers: values.overrideBlockers,
          },
        })
        .returning();
      return result;
    },
  };
}
