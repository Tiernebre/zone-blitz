import { and, asc, desc, eq, sql } from "drizzle-orm";
import type pino from "pino";
import {
  buildContractYears,
  type ContractHistoryEntry,
  type ContractLedgerEntry,
  type CurrentContractSummary,
  type DraftEligiblePlayer,
  neutralBucket,
  type PlayerAccoladeEntry,
  type PlayerAttributes,
  type PlayerDetail,
  type PlayerSeasonStatRow,
  type PlayerTransactionEntry,
} from "@zone-blitz/shared";
import type { Database, Executor } from "../../db/connection.ts";
import { players } from "./player.schema.ts";
import {
  attributeSelectColumns,
  pickAttributes,
  playerAttributes,
} from "./attributes.schema.ts";
import { ageFromBirthDate } from "./age.ts";
import { contracts } from "../contracts/contract.schema.ts";
import { contractHistory } from "../contracts/contract-history.schema.ts";
import { playerTransactions } from "../contracts/player-transaction.schema.ts";
import { playerDraftProfile } from "./player-draft-profile.schema.ts";
import { playerSeasonStats } from "./player-career-log.schema.ts";
import { playerAccolades } from "./player-accolades.schema.ts";
import { teams } from "../team/team.schema.ts";
import { cities } from "../cities/city.schema.ts";
import { alias } from "drizzle-orm/pg-core";
import type { PlayersRepository } from "./players.repository.interface.ts";

export function createPlayersRepository(deps: {
  db: Database;
  log: pino.Logger;
  now?: () => Date;
}): PlayersRepository {
  const log = deps.log.child({ module: "players.repository" });
  const now = deps.now ?? (() => new Date());
  const currentTeams = alias(teams, "current_team");
  const draftingTeams = alias(teams, "drafting_team");
  const currentCities = alias(cities, "current_city");
  const draftingCities = alias(cities, "drafting_city");
  const txTeams = alias(teams, "tx_team");
  const txCities = alias(cities, "tx_city");
  const txCounterTeams = alias(teams, "tx_counter_team");
  const txCounterCities = alias(cities, "tx_counter_city");
  const counterpartyPlayers = alias(players, "counterparty_player");

  async function loadTransactions(
    playerId: string,
  ): Promise<PlayerTransactionEntry[]> {
    const rows = await deps.db
      .select({
        id: playerTransactions.id,
        type: playerTransactions.type,
        seasonYear: playerTransactions.seasonYear,
        occurredAt: playerTransactions.occurredAt,
        detail: playerTransactions.detail,
        tradeId: playerTransactions.tradeId,
        teamId: txTeams.id,
        teamName: txTeams.name,
        teamCity: txCities.name,
        teamAbbreviation: txTeams.abbreviation,
        counterpartyTeamId: txCounterTeams.id,
        counterpartyTeamName: txCounterTeams.name,
        counterpartyTeamCity: txCounterCities.name,
        counterpartyTeamAbbreviation: txCounterTeams.abbreviation,
        counterpartyPlayerId: counterpartyPlayers.id,
        counterpartyPlayerFirstName: counterpartyPlayers.firstName,
        counterpartyPlayerLastName: counterpartyPlayers.lastName,
      })
      .from(playerTransactions)
      .leftJoin(txTeams, eq(txTeams.id, playerTransactions.teamId))
      .leftJoin(txCities, eq(txCities.id, txTeams.cityId))
      .leftJoin(
        txCounterTeams,
        eq(txCounterTeams.id, playerTransactions.counterpartyTeamId),
      )
      .leftJoin(txCounterCities, eq(txCounterCities.id, txCounterTeams.cityId))
      .leftJoin(
        counterpartyPlayers,
        eq(counterpartyPlayers.id, playerTransactions.counterpartyPlayerId),
      )
      .where(eq(playerTransactions.playerId, playerId))
      .orderBy(desc(playerTransactions.occurredAt));

    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      seasonYear: row.seasonYear,
      occurredAt: row.occurredAt.toISOString(),
      detail: row.detail,
      tradeId: row.tradeId,
      team: row.teamId
        ? {
          id: row.teamId,
          name: row.teamName!,
          city: row.teamCity!,
          abbreviation: row.teamAbbreviation!,
        }
        : null,
      counterpartyTeam: row.counterpartyTeamId
        ? {
          id: row.counterpartyTeamId,
          name: row.counterpartyTeamName!,
          city: row.counterpartyTeamCity!,
          abbreviation: row.counterpartyTeamAbbreviation!,
        }
        : null,
      counterpartyPlayer: row.counterpartyPlayerId
        ? {
          id: row.counterpartyPlayerId,
          firstName: row.counterpartyPlayerFirstName!,
          lastName: row.counterpartyPlayerLastName!,
        }
        : null,
    }));
  }

  async function loadSeasonStats(
    playerId: string,
  ): Promise<PlayerSeasonStatRow[]> {
    const rows = await deps.db
      .select({
        id: playerSeasonStats.id,
        seasonYear: playerSeasonStats.seasonYear,
        playoffs: playerSeasonStats.playoffs,
        gamesPlayed: playerSeasonStats.gamesPlayed,
        gamesStarted: playerSeasonStats.gamesStarted,
        stats: playerSeasonStats.stats,
        teamId: teams.id,
        teamName: teams.name,
        teamCity: cities.name,
        teamAbbreviation: teams.abbreviation,
      })
      .from(playerSeasonStats)
      .innerJoin(teams, eq(teams.id, playerSeasonStats.teamId))
      .innerJoin(cities, eq(cities.id, teams.cityId))
      .where(eq(playerSeasonStats.playerId, playerId))
      .orderBy(
        asc(playerSeasonStats.seasonYear),
        asc(playerSeasonStats.playoffs),
      );
    return rows.map((row) => ({
      id: row.id,
      seasonYear: row.seasonYear,
      playoffs: row.playoffs,
      gamesPlayed: row.gamesPlayed,
      gamesStarted: row.gamesStarted,
      stats: (row.stats ?? {}) as Record<string, number | string>,
      team: {
        id: row.teamId,
        name: row.teamName,
        city: row.teamCity,
        abbreviation: row.teamAbbreviation,
      },
    }));
  }

  async function loadAccolades(
    playerId: string,
  ): Promise<PlayerAccoladeEntry[]> {
    const rows = await deps.db
      .select({
        id: playerAccolades.id,
        seasonYear: playerAccolades.seasonYear,
        type: playerAccolades.type,
        detail: playerAccolades.detail,
      })
      .from(playerAccolades)
      .where(eq(playerAccolades.playerId, playerId))
      .orderBy(asc(playerAccolades.seasonYear));
    return rows;
  }

  return {
    async getDetailById(playerId) {
      log.debug({ playerId }, "fetching player detail");

      const [row] = await deps.db
        .select({
          id: players.id,
          status: players.status,
          firstName: players.firstName,
          lastName: players.lastName,
          jerseyNumber: players.jerseyNumber,
          injuryStatus: players.injuryStatus,
          heightInches: players.heightInches,
          weightPounds: players.weightPounds,
          college: players.college,
          hometown: players.hometown,
          birthDate: players.birthDate,
          draftYear: players.draftYear,
          draftRound: players.draftRound,
          draftPick: players.draftPick,
          currentTeamId: currentTeams.id,
          currentTeamName: currentTeams.name,
          currentTeamCity: currentCities.name,
          currentTeamAbbreviation: currentTeams.abbreviation,
          draftingTeamId: draftingTeams.id,
          draftingTeamName: draftingTeams.name,
          draftingTeamCity: draftingCities.name,
          draftingTeamAbbreviation: draftingTeams.abbreviation,
          preDraftClassYear: playerDraftProfile.draftClassYear,
          preDraftProjectedRound: playerDraftProfile.projectedRound,
          preDraftScoutingNotes: playerDraftProfile.scoutingNotes,
          ...attributeSelectColumns(),
        })
        .from(players)
        .innerJoin(
          playerAttributes,
          eq(playerAttributes.playerId, players.id),
        )
        .leftJoin(currentTeams, eq(currentTeams.id, players.teamId))
        .leftJoin(currentCities, eq(currentCities.id, currentTeams.cityId))
        .leftJoin(draftingTeams, eq(draftingTeams.id, players.draftingTeamId))
        .leftJoin(draftingCities, eq(draftingCities.id, draftingTeams.cityId))
        .leftJoin(
          playerDraftProfile,
          eq(playerDraftProfile.playerId, players.id),
        )
        .where(eq(players.id, playerId))
        .limit(1);

      if (!row) return undefined;

      const attributes: PlayerAttributes = pickAttributes(
        row as unknown as Record<string, unknown>,
      );
      const bucket = neutralBucket({
        attributes,
        heightInches: row.heightInches,
        weightPounds: row.weightPounds,
      });

      const yearsOfExperience = row.draftYear !== null
        ? Math.max(0, now().getUTCFullYear() - row.draftYear)
        : 0;

      const [currentContractRow] = await deps.db
        .select({
          id: contracts.id,
          teamId: contracts.teamId,
          teamName: currentTeams.name,
          teamCity: currentCities.name,
          teamAbbreviation: currentTeams.abbreviation,
          signedYear: contracts.signedYear,
          totalYears: contracts.totalYears,
          realYears: contracts.realYears,
          signingBonus: contracts.signingBonus,
          isRookieDeal: contracts.isRookieDeal,
          tagType: contracts.tagType,
        })
        .from(contracts)
        .innerJoin(currentTeams, eq(currentTeams.id, contracts.teamId))
        .innerJoin(currentCities, eq(currentCities.id, currentTeams.cityId))
        .where(eq(contracts.playerId, playerId))
        .limit(1);

      const currentContract: CurrentContractSummary | null = currentContractRow
        ? {
          teamId: currentContractRow.teamId,
          signedYear: currentContractRow.signedYear,
          totalYears: currentContractRow.totalYears,
          realYears: currentContractRow.realYears,
          signingBonus: currentContractRow.signingBonus,
          isRookieDeal: currentContractRow.isRookieDeal,
          tagType: currentContractRow.tagType,
        }
        : null;

      const historyRows = await deps.db
        .select({
          id: contractHistory.id,
          teamId: teams.id,
          teamName: teams.name,
          teamCity: cities.name,
          teamAbbreviation: teams.abbreviation,
          contractType: contractHistory.contractType,
          signedInYear: contractHistory.signedInYear,
          totalYears: contractHistory.totalYears,
          totalSalary: contractHistory.totalSalary,
          guaranteedMoney: contractHistory.guaranteedMoney,
          signingBonus: contractHistory.signingBonus,
          terminationReason: contractHistory.terminationReason,
          endedInYear: contractHistory.endedInYear,
        })
        .from(contractHistory)
        .innerJoin(teams, eq(teams.id, contractHistory.teamId))
        .innerJoin(cities, eq(cities.id, teams.cityId))
        .where(eq(contractHistory.playerId, playerId))
        .orderBy(asc(contractHistory.signedInYear));

      const contractHistoryEntries: ContractHistoryEntry[] = historyRows.map(
        (row) => ({
          id: row.id,
          team: {
            id: row.teamId,
            name: row.teamName,
            city: row.teamCity,
            abbreviation: row.teamAbbreviation,
          },
          signedInYear: row.signedInYear,
          totalYears: row.totalYears,
          totalSalary: row.totalSalary,
          guaranteedMoney: row.guaranteedMoney,
          terminationReason: row.terminationReason,
          endedInYear: row.endedInYear,
        }),
      );

      const contractLedger: ContractLedgerEntry[] = [];
      if (currentContractRow) {
        contractLedger.push({
          id: currentContractRow.id,
          team: {
            id: currentContractRow.teamId,
            name: currentContractRow.teamName,
            city: currentContractRow.teamCity,
            abbreviation: currentContractRow.teamAbbreviation,
          },
          contractType: currentContractRow.isRookieDeal
            ? "rookie_scale"
            : "veteran",
          signedInYear: currentContractRow.signedYear,
          totalYears: currentContractRow.totalYears,
          totalValue: 0,
          guaranteedAtSigning: 0,
          signingBonus: currentContractRow.signingBonus,
          years: buildContractYears({
            totalYears: currentContractRow.realYears,
            annualSalary: 0,
            signingBonus: currentContractRow.signingBonus,
            guaranteedMoney: 0,
            currentYear: 1,
          }),
          isCurrent: true,
        });
      }
      for (const row of historyRows) {
        if (
          currentContractRow &&
          row.signedInYear === currentContractRow.signedYear &&
          row.terminationReason === "active"
        ) {
          continue;
        }
        const annualSalary = row.totalYears > 0
          ? Math.floor(row.totalSalary / row.totalYears)
          : 0;
        contractLedger.push({
          id: row.id,
          team: {
            id: row.teamId,
            name: row.teamName,
            city: row.teamCity,
            abbreviation: row.teamAbbreviation,
          },
          contractType: row.contractType,
          signedInYear: row.signedInYear,
          totalYears: row.totalYears,
          totalValue: row.totalSalary,
          guaranteedAtSigning: row.guaranteedMoney,
          signingBonus: row.signingBonus,
          years: buildContractYears({
            totalYears: row.totalYears,
            annualSalary,
            signingBonus: row.signingBonus,
            guaranteedMoney: row.guaranteedMoney,
            currentYear: row.totalYears,
          }),
          isCurrent: false,
          terminationReason: row.terminationReason,
          endedInYear: row.endedInYear,
        });
      }

      const detail: PlayerDetail = {
        id: row.id,
        status: row.status,
        firstName: row.firstName,
        lastName: row.lastName,
        jerseyNumber: row.jerseyNumber,
        neutralBucket: bucket,
        schemeArchetype: null,
        age: ageFromBirthDate(row.birthDate, now()),
        birthDate: row.birthDate,
        heightInches: row.heightInches,
        weightPounds: row.weightPounds,
        yearsOfExperience,
        injuryStatus: row.injuryStatus,
        currentTeam: row.currentTeamId
          ? {
            id: row.currentTeamId,
            name: row.currentTeamName!,
            city: row.currentTeamCity!,
            abbreviation: row.currentTeamAbbreviation!,
          }
          : null,
        origin: {
          draftYear: row.draftYear,
          draftRound: row.draftRound,
          draftPick: row.draftPick,
          draftingTeam: row.draftingTeamId
            ? {
              id: row.draftingTeamId,
              name: row.draftingTeamName!,
              city: row.draftingTeamCity!,
              abbreviation: row.draftingTeamAbbreviation!,
            }
            : null,
          college: row.college,
          hometown: row.hometown,
        },
        currentContract,
        contractHistory: contractHistoryEntries,
        contractLedger,
        transactions: await loadTransactions(playerId),
        seasonStats: await loadSeasonStats(playerId),
        accolades: await loadAccolades(playerId),
        preDraftEvaluation: row.preDraftClassYear !== null
          ? {
            draftClassYear: row.preDraftClassYear,
            projectedRound: row.preDraftProjectedRound,
            scoutingNotes: row.preDraftScoutingNotes,
          }
          : null,
      };
      return detail;
    },

    async findDraftEligiblePlayers(leagueId) {
      log.debug({ leagueId }, "loading draft-eligible players");

      const rows = await deps.db
        .select({
          id: players.id,
          firstName: players.firstName,
          lastName: players.lastName,
          college: players.college,
          hometown: players.hometown,
          heightInches: players.heightInches,
          weightPounds: players.weightPounds,
          birthDate: players.birthDate,
          draftClassYear: playerDraftProfile.draftClassYear,
          projectedRound: playerDraftProfile.projectedRound,
          ...attributeSelectColumns(),
        })
        .from(players)
        .innerJoin(
          playerDraftProfile,
          eq(playerDraftProfile.playerId, players.id),
        )
        .innerJoin(
          playerAttributes,
          eq(playerAttributes.playerId, players.id),
        )
        .where(
          and(
            eq(players.leagueId, leagueId),
            eq(players.status, "prospect"),
          ),
        )
        .orderBy(
          sql`${playerDraftProfile.projectedRound} ASC NULLS LAST`,
          asc(players.lastName),
        );

      return rows.map((row): DraftEligiblePlayer => ({
        id: row.id,
        firstName: row.firstName,
        lastName: row.lastName,
        neutralBucket: neutralBucket({
          attributes: pickAttributes(row as unknown as Record<string, unknown>),
          heightInches: row.heightInches,
          weightPounds: row.weightPounds,
        }),
        schemeArchetype: null,
        college: row.college,
        hometown: row.hometown,
        heightInches: row.heightInches,
        weightPounds: row.weightPounds,
        birthDate: row.birthDate,
        draftClassYear: row.draftClassYear,
        projectedRound: row.projectedRound,
      }));
    },

    async transitionProspectToActive(input, tx) {
      log.info(
        { playerId: input.playerId, teamId: input.teamId },
        "transitioning prospect to active",
      );
      const exec: Executor = tx ?? deps.db;

      const updated = await exec
        .update(players)
        .set({
          status: "active",
          teamId: input.teamId,
          draftingTeamId: input.teamId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(players.id, input.playerId),
            eq(players.status, "prospect"),
          ),
        )
        .returning({ id: players.id });

      return updated.length === 1 ? "ok" : "not_found";
    },
  };
}
