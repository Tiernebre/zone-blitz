import { and, eq } from "drizzle-orm";
import type { Executor } from "../../db/connection.ts";
import type { Database } from "../../db/connection.ts";
import { leagueAdvanceVote, leagueClock } from "./league-clock.schema.ts";
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

export interface LeagueAdvanceVoteRow {
  leagueId: string;
  teamId: string;
  phase: string;
  stepIndex: number;
  readyAt: Date;
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

  castVote(
    vote: {
      leagueId: string;
      teamId: string;
      phase: string;
      stepIndex: number;
    },
    tx?: Executor,
  ): Promise<LeagueAdvanceVoteRow>;

  getVotesForStep(
    leagueId: string,
    phase: string,
    stepIndex: number,
    tx?: Executor,
  ): Promise<LeagueAdvanceVoteRow[]>;
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

    async castVote(vote, tx) {
      log.debug(
        {
          leagueId: vote.leagueId,
          teamId: vote.teamId,
          phase: vote.phase,
          stepIndex: vote.stepIndex,
        },
        "casting advance vote",
      );
      const values = {
        leagueId: vote.leagueId,
        teamId: vote.teamId,
        phase: vote.phase as typeof leagueAdvanceVote.$inferInsert.phase,
        stepIndex: vote.stepIndex,
        readyAt: new Date(),
      };
      const [result] = await (tx ?? deps.db)
        .insert(leagueAdvanceVote)
        .values(values)
        .onConflictDoUpdate({
          target: [
            leagueAdvanceVote.leagueId,
            leagueAdvanceVote.teamId,
            leagueAdvanceVote.phase,
            leagueAdvanceVote.stepIndex,
          ],
          set: { readyAt: values.readyAt },
        })
        .returning();
      return result;
    },

    async getVotesForStep(leagueId, phase, stepIndex, tx) {
      log.debug({ leagueId, phase, stepIndex }, "fetching votes for step");
      return await (tx ?? deps.db)
        .select()
        .from(leagueAdvanceVote)
        .where(
          and(
            eq(leagueAdvanceVote.leagueId, leagueId),
            eq(
              leagueAdvanceVote.phase,
              phase as typeof leagueAdvanceVote.$inferInsert.phase,
            ),
            eq(leagueAdvanceVote.stepIndex, stepIndex),
          ),
        );
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
