import { eq } from "drizzle-orm";
import type pino from "pino";
import type {
  CoachAccolade,
  CoachCareerStop,
  CoachConnection,
  CoachDepthChartNote,
  CoachDetail,
  CoachNode,
  CoachSummary,
  CoachTenurePlayerDev,
  CoachTenureUnitSeason,
} from "@zone-blitz/shared";
import type { Database } from "../../db/connection.ts";
import { coaches } from "./coach.schema.ts";
import {
  coachAccolades,
  coachCareerStops,
  coachConnections,
  coachDepthChartNotes,
  coachReputationLabels,
  coachTenurePlayerDev,
  coachTenureUnitPerformance,
} from "./coach-history.schema.ts";
import { colleges } from "../colleges/college.schema.ts";
import type { CoachesRepository } from "./coaches.repository.interface.ts";

function yearsBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  const years = ms / (365.25 * 24 * 60 * 60 * 1000);
  return Math.max(0, Math.floor(years));
}

export function createCoachesRepository(deps: {
  db: Database;
  log: pino.Logger;
  /**
   * Override for `now` in tests so `yearsWithTeam` is deterministic.
   * Defaults to `() => new Date()`.
   */
  now?: () => Date;
}): CoachesRepository {
  const log = deps.log.child({ module: "coaches.repository" });
  const now = deps.now ?? (() => new Date());

  return {
    async getStaffTreeByTeam(teamId) {
      log.debug({ teamId }, "fetching staff tree");
      const rows = await deps.db
        .select()
        .from(coaches)
        .where(eq(coaches.teamId, teamId));
      const today = now();
      return rows.map((row): CoachNode => ({
        id: row.id,
        firstName: row.firstName,
        lastName: row.lastName,
        role: row.role,
        reportsToId: row.reportsToId,
        playCaller: row.playCaller,
        specialty: row.specialty,
        age: row.age,
        yearsWithTeam: yearsBetween(row.hiredAt, today),
        contractYearsRemaining: row.contractYears,
        isVacancy: row.isVacancy,
      }));
    },

    async getCoachDetailById(id) {
      log.debug({ id }, "fetching coach detail");
      const [row] = await deps.db
        .select()
        .from(coaches)
        .where(eq(coaches.id, id))
        .limit(1);
      if (!row) return undefined;

      const [
        collegeRow,
        mentorRow,
        reputationRows,
        careerStopRows,
        tenurePerfRows,
        tenureDevRows,
        accoladeRows,
        depthChartRows,
        connectionRows,
      ] = await Promise.all([
        row.collegeId
          ? deps.db
            .select()
            .from(colleges)
            .where(eq(colleges.id, row.collegeId))
            .limit(1)
          : Promise.resolve([]),
        row.mentorCoachId
          ? deps.db
            .select()
            .from(coaches)
            .where(eq(coaches.id, row.mentorCoachId))
            .limit(1)
          : Promise.resolve([]),
        deps.db
          .select()
          .from(coachReputationLabels)
          .where(eq(coachReputationLabels.coachId, id)),
        deps.db
          .select()
          .from(coachCareerStops)
          .where(eq(coachCareerStops.coachId, id)),
        deps.db
          .select()
          .from(coachTenureUnitPerformance)
          .where(eq(coachTenureUnitPerformance.coachId, id)),
        deps.db
          .select()
          .from(coachTenurePlayerDev)
          .where(eq(coachTenurePlayerDev.coachId, id)),
        deps.db
          .select()
          .from(coachAccolades)
          .where(eq(coachAccolades.coachId, id)),
        deps.db
          .select()
          .from(coachDepthChartNotes)
          .where(eq(coachDepthChartNotes.coachId, id)),
        deps.db
          .select({
            relation: coachConnections.relation,
            id: coaches.id,
            firstName: coaches.firstName,
            lastName: coaches.lastName,
            role: coaches.role,
          })
          .from(coachConnections)
          .innerJoin(coaches, eq(coachConnections.otherCoachId, coaches.id))
          .where(eq(coachConnections.coachId, id)),
      ]);

      const today = now();
      const college = collegeRow[0];
      const mentor = mentorRow[0];

      const careerStops: CoachCareerStop[] = careerStopRows.map((stop) => ({
        id: stop.id,
        teamName: stop.teamName,
        role: stop.role,
        startYear: stop.startYear,
        endYear: stop.endYear,
        teamWins: stop.teamWins,
        teamLosses: stop.teamLosses,
        teamTies: stop.teamTies,
        unitRank: stop.unitRank,
        unitSide: stop.unitSide,
      }));

      const tenureUnitPerformance: CoachTenureUnitSeason[] = tenurePerfRows
        .map((p) => ({
          season: p.season,
          unitSide: p.unitSide,
          rank: p.rank,
          metrics: p.metrics as Record<string, unknown> | null,
        }));

      const tenurePlayerDev: CoachTenurePlayerDev[] = tenureDevRows.map(
        (d) => ({
          playerId: d.playerId,
          season: d.season,
          delta: d.delta,
          note: d.note,
        }),
      );

      const accolades: CoachAccolade[] = accoladeRows.map((a) => ({
        id: a.id,
        season: a.season,
        type: a.type,
        detail: a.detail,
      }));

      const depthChartNotes: CoachDepthChartNote[] = depthChartRows.map((
        n,
      ) => ({
        id: n.id,
        season: n.season,
        note: n.note,
      }));

      const connections: CoachConnection[] = connectionRows.map((c) => ({
        relation: c.relation,
        coach: {
          id: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
          role: c.role,
        },
      }));

      const mentorSummary: CoachSummary | null = mentor
        ? {
          id: mentor.id,
          firstName: mentor.firstName,
          lastName: mentor.lastName,
          role: mentor.role,
        }
        : null;

      const detail: CoachDetail = {
        id: row.id,
        leagueId: row.leagueId,
        teamId: row.teamId,
        firstName: row.firstName,
        lastName: row.lastName,
        role: row.role,
        specialty: row.specialty,
        playCaller: row.playCaller,
        age: row.age,
        yearsWithTeam: yearsBetween(row.hiredAt, today),
        contractYearsRemaining: row.contractYears,
        contractSalary: row.contractSalary,
        contractBuyout: row.contractBuyout,
        isVacancy: row.isVacancy,
        college: college
          ? {
            id: college.id,
            shortName: college.shortName,
            nickname: college.nickname,
            conference: college.conference,
          }
          : null,
        mentor: mentorSummary,
        reputationLabels: reputationRows.map((r) => r.label),
        careerStops,
        tenureUnitPerformance,
        tenurePlayerDev,
        accolades,
        depthChartNotes,
        connections,
      };

      return detail;
    },
  };
}
