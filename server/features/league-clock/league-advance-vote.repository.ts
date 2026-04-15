import { and, eq } from "drizzle-orm";
import type { Database, Executor } from "../../db/connection.ts";
import { leagueAdvanceVote } from "./league-clock.schema.ts";
import type pino from "pino";

export interface VoteRow {
  leagueId: string;
  teamId: string;
  phase: string;
  stepIndex: number;
  readyAt: Date;
}

export interface LeagueAdvanceVoteRepository {
  castVote(
    vote: {
      leagueId: string;
      teamId: string;
      phase: string;
      stepIndex: number;
    },
    tx?: Executor,
  ): Promise<VoteRow>;

  getVotesForStep(
    leagueId: string,
    phase: string,
    stepIndex: number,
    tx?: Executor,
  ): Promise<VoteRow[]>;
}

export function createLeagueAdvanceVoteRepository(deps: {
  db: Database;
  log: pino.Logger;
}): LeagueAdvanceVoteRepository {
  const log = deps.log.child({ module: "league-advance-vote.repository" });

  return {
    async castVote(vote, tx) {
      log.debug(
        { leagueId: vote.leagueId, teamId: vote.teamId },
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
  };
}
