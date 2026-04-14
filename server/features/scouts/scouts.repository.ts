import { and, eq } from "drizzle-orm";
import type pino from "pino";
import type {
  ScoutCareerStop,
  ScoutConnection,
  ScoutCrossCheck,
  ScoutDetail,
  ScoutEvaluation,
  ScoutExternalTrackRecord,
  ScoutNode,
  ScoutSummary,
} from "@zone-blitz/shared";
import type { Database } from "../../db/connection.ts";
import { scouts } from "./scout.schema.ts";
import {
  scoutCareerStops,
  scoutConnections,
  scoutCrossChecks,
  scoutEvaluations,
  scoutExternalTrackRecord,
  scoutReputationLabels,
} from "./scout-history.schema.ts";
import type { ScoutsRepository } from "./scouts.repository.interface.ts";

function yearsBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  const years = ms / (365.25 * 24 * 60 * 60 * 1000);
  return Math.max(0, Math.floor(years));
}

export function createScoutsRepository(deps: {
  db: Database;
  log: pino.Logger;
  /**
   * Override for `now` in tests so `yearsWithTeam` is deterministic.
   * Defaults to `() => new Date()`.
   */
  now?: () => Date;
}): ScoutsRepository {
  const log = deps.log.child({ module: "scouts.repository" });
  const now = deps.now ?? (() => new Date());

  return {
    async getStaffTreeByTeam(leagueId, teamId) {
      log.debug({ leagueId, teamId }, "fetching staff tree");
      const rows = await deps.db
        .select()
        .from(scouts)
        .where(and(eq(scouts.leagueId, leagueId), eq(scouts.teamId, teamId)));
      const today = now();
      return rows.map((row): ScoutNode => ({
        id: row.id,
        firstName: row.firstName,
        lastName: row.lastName,
        role: row.role,
        reportsToId: row.reportsToId,
        coverage: row.coverage,
        age: row.age,
        yearsWithTeam: yearsBetween(row.hiredAt, today),
        contractYearsRemaining: row.contractYears,
        workCapacity: row.workCapacity,
        isVacancy: row.isVacancy,
      }));
    },

    async getScoutDetailById(id) {
      log.debug({ id }, "fetching scout detail");
      const [row] = await deps.db
        .select()
        .from(scouts)
        .where(eq(scouts.id, id))
        .limit(1);
      if (!row) return undefined;

      const [
        reputationRows,
        careerStopRows,
        evaluationRows,
        crossCheckRows,
        externalRows,
        connectionRows,
      ] = await Promise.all([
        deps.db
          .select()
          .from(scoutReputationLabels)
          .where(eq(scoutReputationLabels.scoutId, id)),
        deps.db
          .select()
          .from(scoutCareerStops)
          .where(eq(scoutCareerStops.scoutId, id)),
        deps.db
          .select()
          .from(scoutEvaluations)
          .where(eq(scoutEvaluations.scoutId, id)),
        deps.db
          .select({
            id: scoutCrossChecks.id,
            evaluationId: scoutCrossChecks.evaluationId,
            otherGrade: scoutCrossChecks.otherGrade,
            winner: scoutCrossChecks.winner,
            otherId: scouts.id,
            otherFirstName: scouts.firstName,
            otherLastName: scouts.lastName,
            otherRole: scouts.role,
          })
          .from(scoutCrossChecks)
          .innerJoin(
            scoutEvaluations,
            eq(scoutCrossChecks.evaluationId, scoutEvaluations.id),
          )
          .leftJoin(scouts, eq(scoutCrossChecks.otherScoutId, scouts.id))
          .where(eq(scoutEvaluations.scoutId, id)),
        deps.db
          .select()
          .from(scoutExternalTrackRecord)
          .where(eq(scoutExternalTrackRecord.scoutId, id)),
        deps.db
          .select({
            relation: scoutConnections.relation,
            id: scouts.id,
            firstName: scouts.firstName,
            lastName: scouts.lastName,
            role: scouts.role,
          })
          .from(scoutConnections)
          .innerJoin(scouts, eq(scoutConnections.otherScoutId, scouts.id))
          .where(eq(scoutConnections.scoutId, id)),
      ]);

      const today = now();

      const careerStops: ScoutCareerStop[] = careerStopRows.map((stop) => ({
        id: stop.id,
        orgName: stop.orgName,
        role: stop.role,
        startYear: stop.startYear,
        endYear: stop.endYear,
        coverageNotes: stop.coverageNotes,
      }));

      const evaluations: ScoutEvaluation[] = evaluationRows.map((e) => ({
        id: e.id,
        prospectId: e.prospectId,
        prospectName: e.prospectName,
        draftYear: e.draftYear,
        positionGroup: e.positionGroup,
        roundTier: e.roundTier,
        grade: e.grade,
        evaluationLevel: e.evaluationLevel,
        outcome: e.outcome,
        outcomeDetail: e.outcomeDetail,
      }));

      const crossChecks: ScoutCrossCheck[] = crossCheckRows.map((c) => ({
        id: c.id,
        evaluationId: c.evaluationId,
        otherScout: c.otherId
          ? {
            id: c.otherId,
            firstName: c.otherFirstName!,
            lastName: c.otherLastName!,
            role: c.otherRole!,
          }
          : null,
        otherGrade: c.otherGrade,
        winner: c.winner,
      }));

      const externalTrackRecord: ScoutExternalTrackRecord[] = externalRows.map(
        (r) => ({
          id: r.id,
          orgName: r.orgName,
          startYear: r.startYear,
          endYear: r.endYear,
          noisyHitRateLabel: r.noisyHitRateLabel,
        }),
      );

      const connections: ScoutConnection[] = connectionRows.map((
        c,
      ): ScoutConnection => ({
        relation: c.relation,
        scout: {
          id: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
          role: c.role,
        } satisfies ScoutSummary,
      }));

      const detail: ScoutDetail = {
        id: row.id,
        leagueId: row.leagueId,
        teamId: row.teamId,
        firstName: row.firstName,
        lastName: row.lastName,
        role: row.role,
        coverage: row.coverage,
        age: row.age,
        yearsWithTeam: yearsBetween(row.hiredAt, today),
        contractYearsRemaining: row.contractYears,
        contractSalary: row.contractSalary,
        contractBuyout: row.contractBuyout,
        workCapacity: row.workCapacity,
        isVacancy: row.isVacancy,
        reputationLabels: reputationRows.map((r) => r.label),
        careerStops,
        evaluations,
        crossChecks,
        externalTrackRecord,
        connections,
      };

      return detail;
    },
  };
}
