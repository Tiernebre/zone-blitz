import { and, eq, inArray } from "drizzle-orm";
import type pino from "pino";
import {
  assignDepthChart,
  type CoachTendencies,
  depthChartVocabulary,
  neutralBucket,
  type PlayerForAssignment,
} from "@zone-blitz/shared";
import type { Database } from "../../db/connection.ts";
import { players } from "../players/player.schema.ts";
import {
  attributeSelectColumns,
  pickAttributes,
  playerAttributes,
} from "../players/attributes.schema.ts";
import { depthChartEntries } from "../players/depth-chart.schema.ts";
import { coaches } from "../coaches/coach.schema.ts";
import { coachTendencies } from "../coaches/coach-tendencies.schema.ts";
import { toCoachTendencies } from "../coaches/tendency-row.ts";
import { computeFingerprint, computeSchemeScore } from "../schemes/mod.ts";
import type { DepthChartPublisher } from "./depth-chart.publisher.interface.ts";

export function createDepthChartPublisher(deps: {
  db: Database;
  log: pino.Logger;
}): DepthChartPublisher {
  const log = deps.log.child({ module: "depth-chart.publisher" });

  return {
    async publishForTeams(input, tx) {
      const executor = tx ?? deps.db;
      let totalEntries = 0;

      for (const teamId of input.teamIds) {
        log.debug(
          { leagueId: input.leagueId, teamId },
          "publishing depth chart",
        );

        const coordinatorRows = await executor
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
        const vocabulary = depthChartVocabulary(fingerprint);

        const [hc] = await executor
          .select({ id: coaches.id })
          .from(coaches)
          .where(
            and(eq(coaches.teamId, teamId), eq(coaches.role, "HC")),
          )
          .limit(1);

        const playerRows = await executor
          .select({
            id: players.id,
            heightInches: players.heightInches,
            weightPounds: players.weightPounds,
            ...attributeSelectColumns(),
          })
          .from(players)
          .innerJoin(
            playerAttributes,
            eq(playerAttributes.playerId, players.id),
          )
          .where(
            and(
              eq(players.leagueId, input.leagueId),
              eq(players.teamId, teamId),
            ),
          );

        const playersForAssignment: PlayerForAssignment[] = playerRows.map(
          (row) => {
            const attributes = pickAttributes(row);
            const bucket = neutralBucket({
              attributes,
              heightInches: row.heightInches,
              weightPounds: row.weightPounds,
            });
            const score = computeSchemeScore(
              { neutralBucket: bucket, attributes },
              fingerprint,
            );
            return { id: row.id, neutralBucket: bucket, score };
          },
        );

        const assignments = assignDepthChart(playersForAssignment, vocabulary);

        if (assignments.length > 0) {
          await executor
            .delete(depthChartEntries)
            .where(eq(depthChartEntries.teamId, teamId));

          await executor.insert(depthChartEntries).values(
            assignments.map((a) => ({
              teamId,
              playerId: a.playerId,
              slotCode: a.slotCode,
              slotOrdinal: a.slotOrdinal,
              isInactive: a.isInactive,
              publishedByCoachId: hc?.id ?? null,
            })),
          );
        }

        totalEntries += assignments.length;
      }

      return { entryCount: totalEntries };
    },
  };
}
