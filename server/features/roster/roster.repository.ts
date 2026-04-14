import { and, desc, eq } from "drizzle-orm";
import type pino from "pino";
import {
  type DepthChartInactive,
  type DepthChartSlot,
  DomainError,
  PLAYER_POSITION_GROUPS,
  type PlayerPosition,
  type PlayerPositionGroup,
  type RosterPlayer,
  type RosterPositionGroupSummary,
  type RosterStatistics,
} from "@zone-blitz/shared";
import type { Database } from "../../db/connection.ts";
import { players } from "../players/player.schema.ts";
import { contracts } from "../players/contract.schema.ts";
import { depthChartEntries } from "../players/depth-chart.schema.ts";
import { leagues } from "../league/league.schema.ts";
import { coaches } from "../coaches/coach.schema.ts";
import type { RosterRepository } from "./roster.repository.interface.ts";

function positionGroupOf(position: PlayerPosition): PlayerPositionGroup {
  for (const group of ["offense", "defense", "special_teams"] as const) {
    if (PLAYER_POSITION_GROUPS[group].includes(position)) return group;
  }
  throw new Error(`Unknown position group for ${position}`);
}

function ageFromBirthDate(birthDate: string, today: Date): number {
  const birth = new Date(birthDate);
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const monthDelta = today.getUTCMonth() - birth.getUTCMonth();
  if (
    monthDelta < 0 ||
    (monthDelta === 0 && today.getUTCDate() < birth.getUTCDate())
  ) {
    age -= 1;
  }
  return Math.max(0, age);
}

function summarizeGroups(
  rosterPlayers: RosterPlayer[],
): RosterPositionGroupSummary[] {
  const groups: PlayerPositionGroup[] = [
    "offense",
    "defense",
    "special_teams",
  ];
  return groups.map((group) => {
    const members = rosterPlayers.filter((p) => p.positionGroup === group);
    return {
      group,
      headcount: members.length,
      totalCap: members.reduce((sum, p) => sum + p.capHit, 0),
    };
  });
}

export function createRosterRepository(deps: {
  db: Database;
  log: pino.Logger;
  now?: () => Date;
}): RosterRepository {
  const log = deps.log.child({ module: "roster.repository" });
  const now = deps.now ?? (() => new Date());

  return {
    async getActiveRoster(leagueId, teamId) {
      log.debug({ leagueId, teamId }, "fetching active roster");

      const [league] = await deps.db
        .select({ salaryCap: leagues.salaryCap })
        .from(leagues)
        .where(eq(leagues.id, leagueId))
        .limit(1);
      if (!league) {
        throw new DomainError("NOT_FOUND", `League ${leagueId} not found`);
      }

      const rows = await deps.db
        .select({
          id: players.id,
          firstName: players.firstName,
          lastName: players.lastName,
          position: players.position,
          birthDate: players.birthDate,
          injuryStatus: players.injuryStatus,
          annualSalary: contracts.annualSalary,
          totalYears: contracts.totalYears,
          currentYear: contracts.currentYear,
        })
        .from(players)
        .leftJoin(contracts, eq(contracts.playerId, players.id))
        .where(
          and(eq(players.leagueId, leagueId), eq(players.teamId, teamId)),
        );

      const today = now();
      const rosterPlayers: RosterPlayer[] = rows.map((row) => ({
        id: row.id,
        firstName: row.firstName,
        lastName: row.lastName,
        position: row.position,
        positionGroup: positionGroupOf(row.position),
        age: ageFromBirthDate(row.birthDate, today),
        capHit: row.annualSalary ?? 0,
        contractYearsRemaining: row.totalYears !== null &&
            row.currentYear !== null
          ? Math.max(0, row.totalYears - row.currentYear + 1)
          : 0,
        injuryStatus: row.injuryStatus,
      }));

      const totalCap = rosterPlayers.reduce((sum, p) => sum + p.capHit, 0);

      return {
        leagueId,
        teamId,
        players: rosterPlayers,
        positionGroups: summarizeGroups(rosterPlayers),
        totalCap,
        salaryCap: league.salaryCap,
        capSpace: league.salaryCap - totalCap,
      };
    },

    async getDepthChart(leagueId, teamId) {
      log.debug({ leagueId, teamId }, "fetching depth chart");

      const entryRows = await deps.db
        .select({
          playerId: depthChartEntries.playerId,
          position: depthChartEntries.position,
          slotOrdinal: depthChartEntries.slotOrdinal,
          isInactive: depthChartEntries.isInactive,
          publishedAt: depthChartEntries.publishedAt,
          publishedByCoachId: depthChartEntries.publishedByCoachId,
          firstName: players.firstName,
          lastName: players.lastName,
          injuryStatus: players.injuryStatus,
        })
        .from(depthChartEntries)
        .innerJoin(players, eq(players.id, depthChartEntries.playerId))
        .where(
          and(
            eq(depthChartEntries.teamId, teamId),
            eq(players.leagueId, leagueId),
          ),
        );

      const slots: DepthChartSlot[] = [];
      const inactives: DepthChartInactive[] = [];

      for (const row of entryRows) {
        if (row.isInactive) {
          inactives.push({
            playerId: row.playerId,
            firstName: row.firstName,
            lastName: row.lastName,
            position: row.position,
            injuryStatus: row.injuryStatus,
          });
        } else {
          slots.push({
            playerId: row.playerId,
            firstName: row.firstName,
            lastName: row.lastName,
            position: row.position,
            slotOrdinal: row.slotOrdinal,
            injuryStatus: row.injuryStatus,
          });
        }
      }

      slots.sort((a, b) =>
        a.position.localeCompare(b.position) || a.slotOrdinal - b.slotOrdinal
      );

      const [latest] = await deps.db
        .select({
          publishedAt: depthChartEntries.publishedAt,
          publishedByCoachId: depthChartEntries.publishedByCoachId,
        })
        .from(depthChartEntries)
        .where(eq(depthChartEntries.teamId, teamId))
        .orderBy(desc(depthChartEntries.publishedAt))
        .limit(1);

      let lastUpdatedBy = null;
      if (latest?.publishedByCoachId) {
        const [coach] = await deps.db
          .select({
            id: coaches.id,
            firstName: coaches.firstName,
            lastName: coaches.lastName,
            role: coaches.role,
          })
          .from(coaches)
          .where(eq(coaches.id, latest.publishedByCoachId))
          .limit(1);
        if (coach) lastUpdatedBy = coach;
      }

      return {
        leagueId,
        teamId,
        slots,
        inactives,
        lastUpdatedAt: latest?.publishedAt?.toISOString() ?? null,
        lastUpdatedBy,
      };
    },

    getStatistics(leagueId, teamId, seasonId) {
      log.debug(
        { leagueId, teamId, seasonId },
        "fetching roster statistics (stub)",
      );
      const empty: RosterStatistics = {
        leagueId,
        teamId,
        seasonId,
        rows: [],
      };
      return Promise.resolve(empty);
    },
  };
}
