import { asc, eq } from "drizzle-orm";
import type pino from "pino";
import type {
  ContractHistoryEntry,
  CurrentContractSummary,
  PlayerDetail,
} from "@zone-blitz/shared";
import type { Database } from "../../db/connection.ts";
import { players } from "./player.schema.ts";
import { contracts } from "./contract.schema.ts";
import { contractHistory } from "./contract-history.schema.ts";
import { teams } from "../team/team.schema.ts";
import { cities } from "../cities/city.schema.ts";
import { alias } from "drizzle-orm/pg-core";
import type { PlayersRepository } from "./players.repository.interface.ts";

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

  return {
    async getDetailById(playerId) {
      log.debug({ playerId }, "fetching player detail");

      const [row] = await deps.db
        .select({
          id: players.id,
          firstName: players.firstName,
          lastName: players.lastName,
          position: players.position,
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
        })
        .from(players)
        .leftJoin(currentTeams, eq(currentTeams.id, players.teamId))
        .leftJoin(currentCities, eq(currentCities.id, currentTeams.cityId))
        .leftJoin(draftingTeams, eq(draftingTeams.id, players.draftingTeamId))
        .leftJoin(draftingCities, eq(draftingCities.id, draftingTeams.cityId))
        .where(eq(players.id, playerId))
        .limit(1);

      if (!row) return undefined;

      const yearsOfExperience = row.draftYear !== null
        ? Math.max(0, now().getUTCFullYear() - row.draftYear)
        : 0;

      const [currentContractRow] = await deps.db
        .select({
          teamId: contracts.teamId,
          totalYears: contracts.totalYears,
          currentYear: contracts.currentYear,
          annualSalary: contracts.annualSalary,
          totalSalary: contracts.totalSalary,
          guaranteedMoney: contracts.guaranteedMoney,
          signingBonus: contracts.signingBonus,
        })
        .from(contracts)
        .where(eq(contracts.playerId, playerId))
        .limit(1);

      const currentContract: CurrentContractSummary | null = currentContractRow
        ? {
          teamId: currentContractRow.teamId,
          totalYears: currentContractRow.totalYears,
          currentYear: currentContractRow.currentYear,
          yearsRemaining: Math.max(
            0,
            currentContractRow.totalYears - currentContractRow.currentYear +
              1,
          ),
          annualSalary: currentContractRow.annualSalary,
          totalSalary: currentContractRow.totalSalary,
          guaranteedMoney: currentContractRow.guaranteedMoney,
          signingBonus: currentContractRow.signingBonus,
        }
        : null;

      const historyRows = await deps.db
        .select({
          id: contractHistory.id,
          teamId: teams.id,
          teamName: teams.name,
          teamCity: cities.name,
          teamAbbreviation: teams.abbreviation,
          signedInYear: contractHistory.signedInYear,
          totalYears: contractHistory.totalYears,
          totalSalary: contractHistory.totalSalary,
          guaranteedMoney: contractHistory.guaranteedMoney,
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

      const detail: PlayerDetail = {
        id: row.id,
        firstName: row.firstName,
        lastName: row.lastName,
        position: row.position,
        age: ageFromBirthDate(row.birthDate, now()),
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
      };
      return detail;
    },
  };
}
