import { eq } from "drizzle-orm";
import type pino from "pino";
import { DomainError, type PlayerStatus } from "@zone-blitz/shared";
import type { Database } from "../../db/connection.ts";
import {
  chunkedInsert,
  chunkedInsertReturning,
} from "../../db/chunked-insert.ts";
import { players } from "./player.schema.ts";
import { playerAttributes } from "./attributes.schema.ts";
import { playerDraftProfile } from "./player-draft-profile.schema.ts";
import { contracts } from "./contract.schema.ts";
import { contractHistory } from "./contract-history.schema.ts";
import { playerTransactions } from "./player-transaction.schema.ts";
import { seasons } from "../season/season.schema.ts";
import type { PlayersGenerator } from "./players.generator.interface.ts";
import type { PlayersRepository } from "./players.repository.interface.ts";
import type { PlayersService } from "./players.service.interface.ts";

type InsertedPlayerRow = {
  id: string;
  teamId: string | null;
  status: PlayerStatus;
};

export function createPlayersService(deps: {
  generator: PlayersGenerator;
  repo: PlayersRepository;
  db: Database;
  log: pino.Logger;
}): PlayersService {
  const log = deps.log.child({ module: "players.service" });

  return {
    async getDetail(playerId) {
      log.debug({ playerId }, "fetching player detail");
      const detail = await deps.repo.getDetailById(playerId);
      if (!detail) {
        throw new DomainError("NOT_FOUND", `Player ${playerId} not found`);
      }
      return detail;
    },

    async generate(input, tx) {
      const exec = tx ?? deps.db;
      log.info(
        { leagueId: input.leagueId, seasonId: input.seasonId },
        "generating players",
      );

      const generated = deps.generator.generate({
        leagueId: input.leagueId,
        seasonId: input.seasonId,
        teamIds: input.teamIds,
        rosterSize: input.rosterSize,
      });

      let insertedPlayers: InsertedPlayerRow[] = [];

      if (generated.players.length > 0) {
        insertedPlayers = await chunkedInsertReturning<InsertedPlayerRow>(
          exec,
          players,
          generated.players.map((entry) => entry.player),
          { id: players.id, teamId: players.teamId, status: players.status },
        );

        const attributeRows = insertedPlayers.map((row, index) => ({
          playerId: row.id,
          ...generated.players[index].attributes,
        }));
        await chunkedInsert(exec, playerAttributes, attributeRows);

        const activePlayers = insertedPlayers
          .map((row, index) => ({ row, source: generated.players[index] }))
          .filter(({ row }) => row.status === "active");

        const currentLeagueYear = new Date().getUTCFullYear();
        const transactionRows = activePlayers.flatMap(({ row, source }) => {
          const src = source.player;
          const events: {
            playerId: string;
            teamId: string | null;
            counterpartyTeamId: string | null;
            type: "drafted" | "signed";
            seasonYear: number;
            detail: string | null;
          }[] = [];
          if (
            src.draftYear !== null &&
            src.draftingTeamId !== null &&
            src.draftRound !== null &&
            src.draftPick !== null
          ) {
            events.push({
              playerId: row.id,
              teamId: src.draftingTeamId,
              counterpartyTeamId: null,
              type: "drafted",
              seasonYear: src.draftYear,
              detail:
                `Round ${src.draftRound}, pick ${src.draftPick} overall`,
            });
          }
          if (row.teamId !== null) {
            const isOwnDraftTeam = src.draftingTeamId === row.teamId &&
              src.draftYear !== null;
            if (!isOwnDraftTeam) {
              events.push({
                playerId: row.id,
                teamId: row.teamId,
                counterpartyTeamId: null,
                type: "signed",
                seasonYear: currentLeagueYear,
                detail: src.draftYear === null ? "Undrafted free agent" : null,
              });
            }
          }
          return events;
        });
        if (transactionRows.length > 0) {
          await chunkedInsert(exec, playerTransactions, transactionRows);
        }

        const prospectEntries = insertedPlayers
          .map((row, index) => ({ row, entry: generated.players[index] }))
          .filter(({ row }) => row.status === "prospect");

        if (prospectEntries.length > 0) {
          const [season] = await exec
            .select({ year: seasons.year })
            .from(seasons)
            .where(eq(seasons.id, input.seasonId))
            .limit(1);

          if (!season) {
            throw new Error(
              `season ${input.seasonId} not found while generating prospects`,
            );
          }

          const draftProfileRows = prospectEntries.map(({ row, entry }) => ({
            playerId: row.id,
            seasonId: input.seasonId,
            draftClassYear: season.year,
            projectedRound: null,
            scoutingNotes: null,
            ...entry.attributes,
          }));
          await chunkedInsert(exec, playerDraftProfile, draftProfileRows);
        }
      }

      const prospectCount =
        insertedPlayers.filter((p) => p.status === "prospect").length;

      log.info(
        {
          leagueId: input.leagueId,
          players: insertedPlayers.length,
          prospects: prospectCount,
        },
        "persisted players",
      );

      const rosteredPlayers = insertedPlayers.filter(
        (p) => p.status === "active" && p.teamId !== null,
      );
      const generatedContracts = deps.generator.generateContracts({
        salaryCap: input.salaryCap,
        players: rosteredPlayers,
      });

      if (generatedContracts.length > 0) {
        await chunkedInsert(exec, contracts, generatedContracts);

        const currentLeagueYear = new Date().getUTCFullYear();
        const historyRows = generatedContracts.map((contract) => ({
          playerId: contract.playerId,
          teamId: contract.teamId,
          signedInYear: currentLeagueYear - (contract.currentYear - 1),
          totalYears: contract.totalYears,
          totalSalary: contract.totalSalary,
          guaranteedMoney: contract.guaranteedMoney,
          terminationReason: "active" as const,
          endedInYear: null,
        }));
        await chunkedInsert(exec, contractHistory, historyRows);
      }

      log.info(
        {
          leagueId: input.leagueId,
          contracts: generatedContracts.length,
        },
        "persisted contracts",
      );

      return {
        playerCount: insertedPlayers.length,
        draftProspectCount: prospectCount,
        contractCount: generatedContracts.length,
      };
    },
  };
}
