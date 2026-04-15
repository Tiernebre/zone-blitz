import { count, eq, sql } from "drizzle-orm";
import type pino from "pino";
import type { Database } from "../../db/connection.ts";
import { leagueClock, leaguePhaseStep } from "./league-clock.schema.ts";
import { contracts } from "../contracts/contract.schema.ts";
import { contractHistory } from "../contracts/contract-history.schema.ts";
import { leagues } from "../league/league.schema.ts";
import { players } from "../players/player.schema.ts";
import type { LeagueClockRepository } from "./league-clock.repository.interface.ts";
import type { Blocker } from "./league-clock.types.ts";

export function createLeagueClockRepository(deps: {
  db: Database;
  log: pino.Logger;
}): LeagueClockRepository {
  const log = deps.log.child({ module: "league-clock.repository" });

  return {
    async getClock(leagueId) {
      log.debug({ leagueId }, "fetching league clock");
      const [row] = await deps.db
        .select()
        .from(leagueClock)
        .where(eq(leagueClock.leagueId, leagueId))
        .limit(1);
      if (!row) return undefined;
      return {
        leagueId: row.leagueId,
        seasonYear: row.seasonYear,
        phase: row.phase,
        stepIndex: row.stepIndex,
        advancedAt: row.advancedAt,
        advancedByUserId: row.advancedByUserId,
        overrideReason: row.overrideReason,
        overrideBlockers: row.overrideBlockers as Blocker[] | null,
      };
    },

    async getPhaseSteps(phase) {
      log.debug({ phase }, "fetching phase steps");
      const rows = await deps.db
        .select({
          phase: leaguePhaseStep.phase,
          stepIndex: leaguePhaseStep.stepIndex,
          slug: leaguePhaseStep.slug,
          kind: leaguePhaseStep.kind,
        })
        .from(leaguePhaseStep)
        .where(eq(leaguePhaseStep.phase, phase));
      return rows;
    },

    async getAllPhaseSteps() {
      log.debug("fetching all phase steps");
      const rows = await deps.db
        .select({
          phase: leaguePhaseStep.phase,
          stepIndex: leaguePhaseStep.stepIndex,
          slug: leaguePhaseStep.slug,
          kind: leaguePhaseStep.kind,
        })
        .from(leaguePhaseStep);
      return rows;
    },

    async writeClock(row, tx?) {
      log.info(
        { leagueId: row.leagueId, phase: row.phase, stepIndex: row.stepIndex },
        "writing league clock",
      );
      const executor = tx ?? deps.db;
      const [written] = await executor
        .insert(leagueClock)
        .values({
          leagueId: row.leagueId,
          seasonYear: row.seasonYear,
          phase: row.phase,
          stepIndex: row.stepIndex,
          advancedByUserId: row.advancedByUserId,
          advancedAt: new Date(),
          overrideReason: row.overrideReason ?? null,
          overrideBlockers: row.overrideBlockers ?? null,
        })
        .onConflictDoUpdate({
          target: leagueClock.leagueId,
          set: {
            seasonYear: row.seasonYear,
            phase: row.phase,
            stepIndex: row.stepIndex,
            advancedByUserId: row.advancedByUserId,
            advancedAt: new Date(),
            overrideReason: row.overrideReason ?? null,
            overrideBlockers: row.overrideBlockers ?? null,
          },
        })
        .returning();
      return {
        leagueId: written.leagueId,
        seasonYear: written.seasonYear,
        phase: written.phase,
        stepIndex: written.stepIndex,
        advancedAt: written.advancedAt,
        advancedByUserId: written.advancedByUserId,
        overrideReason: written.overrideReason,
        overrideBlockers: written.overrideBlockers as Blocker[] | null,
      };
    },

    async getTeamRosterSummaries(leagueId) {
      log.debug({ leagueId }, "fetching team roster summaries");
      const rows = await deps.db
        .select({
          teamId: players.teamId,
          rosterCount: count(players.id),
          totalCap: sql<number>`coalesce(sum(${contracts.annualSalary}), 0)`,
        })
        .from(players)
        .leftJoin(contracts, eq(contracts.playerId, players.id))
        .where(eq(players.leagueId, leagueId))
        .groupBy(players.teamId);
      return rows.map((r) => ({
        teamId: r.teamId!,
        rosterCount: Number(r.rosterCount),
        totalCap: Number(r.totalCap),
      }));
    },

    async expireContracts(leagueId, seasonYear, tx?) {
      log.info({ leagueId, seasonYear }, "expiring contracts");
      const executor = tx ?? deps.db;

      const expiring = await executor
        .select({
          id: contracts.id,
          playerId: contracts.playerId,
          teamId: contracts.teamId,
          contractType: contracts.contractType,
          totalYears: contracts.totalYears,
          totalSalary: contracts.totalSalary,
          guaranteedMoney: contracts.guaranteedMoney,
          signingBonus: contracts.signingBonus,
          signedInYear: contracts.signedInYear,
          currentYear: contracts.currentYear,
        })
        .from(contracts)
        .innerJoin(players, eq(players.id, contracts.playerId))
        .where(eq(players.leagueId, leagueId));

      for (const c of expiring) {
        if (c.currentYear >= c.totalYears) {
          await executor.insert(contractHistory).values({
            playerId: c.playerId,
            teamId: c.teamId,
            contractType: c.contractType,
            signedInYear: c.signedInYear ?? seasonYear,
            totalYears: c.totalYears,
            totalSalary: c.totalSalary,
            guaranteedMoney: c.guaranteedMoney,
            signingBonus: c.signingBonus,
            terminationReason: "expired",
            endedInYear: seasonYear,
          });
          await executor
            .delete(contracts)
            .where(eq(contracts.id, c.id));
        } else {
          await executor
            .update(contracts)
            .set({ currentYear: c.currentYear + 1 })
            .where(eq(contracts.id, c.id));
        }
      }
    },

    async rollCapForward(leagueId, growthRate, tx?) {
      log.info({ leagueId, growthRate }, "rolling cap forward");
      const executor = tx ?? deps.db;
      await executor
        .update(leagues)
        .set({
          salaryCap: sql`${leagues.salaryCap} * (100 + ${growthRate}) / 100`,
        })
        .where(eq(leagues.id, leagueId));
    },

    async incrementSeasonYear(leagueId, tx?) {
      log.info({ leagueId }, "incrementing season year");
      const executor = tx ?? deps.db;
      await executor
        .update(leagueClock)
        .set({
          seasonYear: sql`${leagueClock.seasonYear} + 1`,
        })
        .where(eq(leagueClock.leagueId, leagueId));
    },
  };
}
