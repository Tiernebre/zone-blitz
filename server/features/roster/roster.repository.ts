import { and, desc, eq, inArray } from "drizzle-orm";
import type pino from "pino";
import {
  type CoachTendencies,
  type DepthChartInactive,
  type DepthChartSlot,
  depthChartVocabulary,
  DomainError,
  neutralBucket,
  type NeutralBucketGroup,
  neutralBucketGroupOf,
  type PlayerAttributes,
  type RosterPlayer,
  type RosterPositionGroupSummary,
  type RosterStatistics,
  type SchemeFitLabel,
} from "@zone-blitz/shared";
import type { Database } from "../../db/connection.ts";
import { players } from "../players/player.schema.ts";
import {
  attributeSelectColumns,
  pickAttributes,
  playerAttributes,
} from "../players/attributes.schema.ts";
import { ageFromBirthDate } from "../players/age.ts";
import { contracts } from "../contracts/contract.schema.ts";
import { depthChartEntries } from "../players/depth-chart.schema.ts";
import { leagues } from "../league/league.schema.ts";
import { coaches } from "../coaches/coach.schema.ts";
import { coachTendencies } from "../coaches/coach-tendencies.schema.ts";
import { toCoachTendencies } from "../coaches/tendency-row.ts";
import {
  computeFingerprint,
  computeSchemeFit,
  schemeLens,
} from "../schemes/mod.ts";
import type { RosterRepository } from "./roster.repository.interface.ts";

function summarizeGroups(
  rosterPlayers: RosterPlayer[],
): RosterPositionGroupSummary[] {
  const groups: NeutralBucketGroup[] = [
    "offense",
    "defense",
    "special_teams",
  ];
  return groups.map((group) => {
    const members = rosterPlayers.filter(
      (p) => p.neutralBucketGroup === group,
    );
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
          heightInches: players.heightInches,
          weightPounds: players.weightPounds,
          birthDate: players.birthDate,
          injuryStatus: players.injuryStatus,
          realYears: contracts.realYears,
          depthChartSlot: depthChartEntries.slotCode,
          ...attributeSelectColumns(),
        })
        .from(players)
        .innerJoin(
          playerAttributes,
          eq(playerAttributes.playerId, players.id),
        )
        .leftJoin(contracts, eq(contracts.playerId, players.id))
        .leftJoin(
          depthChartEntries,
          and(
            eq(depthChartEntries.playerId, players.id),
            eq(depthChartEntries.teamId, teamId),
          ),
        )
        .where(
          and(eq(players.leagueId, leagueId), eq(players.teamId, teamId)),
        );

      const coordinatorRows = await deps.db
        .select({
          role: coaches.role,
          tendencyRow: coachTendencies,
        })
        .from(coaches)
        .innerJoin(
          coachTendencies,
          eq(coachTendencies.coachId, coaches.id),
        )
        .where(
          and(
            eq(coaches.teamId, teamId),
            inArray(coaches.role, ["OC", "DC"]),
          ),
        );

      let ocTendencies: CoachTendencies | null = null;
      let dcTendencies: CoachTendencies | null = null;
      for (const row of coordinatorRows) {
        if (!row.tendencyRow) continue;
        const tendencies = toCoachTendencies(row.tendencyRow);
        if (row.role === "OC") ocTendencies = tendencies;
        if (row.role === "DC") dcTendencies = tendencies;
      }
      const fingerprint = computeFingerprint({
        oc: ocTendencies,
        dc: dcTendencies,
      });
      const hasStaff = ocTendencies !== null || dcTendencies !== null;

      const today = now();
      const rosterPlayers: RosterPlayer[] = rows.map((row) => {
        const attributes: PlayerAttributes = pickAttributes(
          row as unknown as Record<string, unknown>,
        );
        const bucket = neutralBucket({
          attributes,
          heightInches: row.heightInches,
          weightPounds: row.weightPounds,
        });
        const schemeFit: SchemeFitLabel | null = hasStaff
          ? computeSchemeFit(
            { neutralBucket: bucket, attributes },
            fingerprint,
          )
          : null;
        const schemeArchetype = hasStaff
          ? schemeLens({ neutralBucket: bucket, attributes }, fingerprint)
          : null;
        return {
          id: row.id,
          firstName: row.firstName,
          lastName: row.lastName,
          neutralBucket: bucket,
          neutralBucketGroup: neutralBucketGroupOf(bucket),
          age: ageFromBirthDate(row.birthDate, today),
          capHit: 0,
          contractYearsRemaining: row.realYears ?? 0,
          injuryStatus: row.injuryStatus,
          schemeFit,
          schemeArchetype,
          depthChartSlot: row.depthChartSlot ?? null,
        };
      });

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

      const [entryRows, coordinatorRows] = await Promise.all([
        deps.db
          .select({
            playerId: depthChartEntries.playerId,
            slotCode: depthChartEntries.slotCode,
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
          ),
        deps.db
          .select({
            role: coaches.role,
            tendencyRow: coachTendencies,
          })
          .from(coaches)
          .innerJoin(
            coachTendencies,
            eq(coachTendencies.coachId, coaches.id),
          )
          .where(
            and(
              eq(coaches.teamId, teamId),
              inArray(coaches.role, ["OC", "DC"]),
            ),
          ),
      ]);

      let ocTendencies: CoachTendencies | null = null;
      let dcTendencies: CoachTendencies | null = null;
      for (const row of coordinatorRows) {
        if (!row.tendencyRow) continue;
        const tendencies = toCoachTendencies(row.tendencyRow);
        if (row.role === "OC") ocTendencies = tendencies;
        if (row.role === "DC") dcTendencies = tendencies;
      }
      const fingerprint = computeFingerprint({
        oc: ocTendencies,
        dc: dcTendencies,
      });
      const vocabulary = depthChartVocabulary(fingerprint);

      const slots: DepthChartSlot[] = [];
      const inactives: DepthChartInactive[] = [];

      for (const row of entryRows) {
        if (row.isInactive) {
          inactives.push({
            playerId: row.playerId,
            firstName: row.firstName,
            lastName: row.lastName,
            slotCode: row.slotCode,
            injuryStatus: row.injuryStatus,
          });
        } else {
          slots.push({
            playerId: row.playerId,
            firstName: row.firstName,
            lastName: row.lastName,
            slotCode: row.slotCode,
            slotOrdinal: row.slotOrdinal,
            injuryStatus: row.injuryStatus,
          });
        }
      }

      slots.sort((a, b) =>
        a.slotCode.localeCompare(b.slotCode) || a.slotOrdinal - b.slotOrdinal
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
        vocabulary,
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
