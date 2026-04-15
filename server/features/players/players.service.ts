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
import {
  contractBonusProrations,
  contracts,
  contractYears,
} from "../contracts/contract.schema.ts";
import { contractHistory } from "../contracts/contract-history.schema.ts";
import { playerTransactions } from "../contracts/player-transaction.schema.ts";
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

    findDraftEligiblePlayers(leagueId) {
      return deps.repo.findDraftEligiblePlayers(leagueId);
    },

    async draftPlayer(input) {
      log.info(
        { playerId: input.playerId, teamId: input.teamId },
        "drafting player",
      );
      const result = await deps.db.transaction((tx) =>
        deps.repo.transitionProspectToActive(input, tx)
      );
      if (result === "not_found") {
        throw new DomainError(
          "NOT_FOUND",
          `Player ${input.playerId} is not draft-eligible`,
        );
      }
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
              detail: `Round ${src.draftRound}, pick ${src.draftPick} overall`,
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
      const contractBundles = deps.generator.generateContracts({
        salaryCap: input.salaryCap,
        players: rosteredPlayers,
      });

      if (contractBundles.length > 0) {
        const contractRows = contractBundles.map(
          (b) => b.contract as unknown as Record<string, unknown>,
        );
        const insertedContracts = await chunkedInsertReturning<{
          id: string;
          playerId: string;
          teamId: string;
          signedYear: number;
          totalYears: number;
          signingBonus: number;
        }>(exec, contracts, contractRows, {
          id: contracts.id,
          playerId: contracts.playerId,
          teamId: contracts.teamId,
          signedYear: contracts.signedYear,
          totalYears: contracts.totalYears,
          signingBonus: contracts.signingBonus,
        });

        const yearRows = insertedContracts.flatMap((row, idx) =>
          contractBundles[idx].years.map((y) => ({
            contractId: row.id,
            ...y,
          }))
        );
        if (yearRows.length > 0) {
          await chunkedInsert(exec, contractYears, yearRows);
        }

        const prorationRows = insertedContracts.flatMap((row, idx) =>
          contractBundles[idx].bonusProrations.map((p) => ({
            contractId: row.id,
            ...p,
          }))
        );
        if (prorationRows.length > 0) {
          await chunkedInsert(exec, contractBonusProrations, prorationRows);
        }

        const totalBaseSalaryForHistory = (bundleIdx: number) =>
          contractBundles[bundleIdx].years.reduce(
            (sum, y) => sum + y.base,
            0,
          );

        const historyRows = insertedContracts.map((row, idx) => ({
          playerId: row.playerId,
          teamId: row.teamId,
          signedInYear: row.signedYear,
          totalYears: row.totalYears,
          totalSalary: totalBaseSalaryForHistory(idx) + row.signingBonus,
          guaranteedMoney: contractBundles[idx].years
            .filter((y) => y.guaranteeType === "full")
            .reduce((sum, y) => sum + y.base, 0),
          terminationReason: "active" as const,
          endedInYear: null,
        }));
        await chunkedInsert(exec, contractHistory, historyRows);
      }

      log.info(
        {
          leagueId: input.leagueId,
          contracts: contractBundles.length,
        },
        "persisted contracts",
      );

      return {
        playerCount: insertedPlayers.length,
        draftProspectCount: prospectCount,
        contractCount: contractBundles.length,
      };
    },
  };
}
