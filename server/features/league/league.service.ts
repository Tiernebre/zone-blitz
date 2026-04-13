import type {
  LeagueRepository,
  LeagueService,
  PersonnelGenerator,
  ScheduleGenerator,
  SeasonRepository,
  TeamRepository,
} from "@zone-blitz/shared";
import { DomainError } from "@zone-blitz/shared";
import type pino from "pino";
import type { Database } from "../../db/connection.ts";
import {
  coaches,
  draftProspects,
  frontOfficeStaff,
  players,
  scouts,
} from "../personnel/personnel.schema.ts";
import { contracts } from "../personnel/contract.schema.ts";
import { games } from "../schedule/game.schema.ts";

export function createLeagueService(deps: {
  leagueRepo: LeagueRepository;
  seasonRepo: SeasonRepository;
  teamRepo: TeamRepository;
  personnelGenerator: PersonnelGenerator;
  scheduleGenerator: ScheduleGenerator;
  db: Database;
  log: pino.Logger;
}): LeagueService {
  const log = deps.log.child({ module: "league.service" });

  return {
    async getAll() {
      log.debug("fetching all leagues");
      return await deps.leagueRepo.getAll();
    },

    async getById(id) {
      log.debug({ id }, "fetching league by id");
      const league = await deps.leagueRepo.getById(id);
      if (!league) {
        throw new DomainError("NOT_FOUND", `League ${id} not found`);
      }
      return league;
    },

    async create(input) {
      log.info({ name: input.name }, "creating league");

      // 1. Create the league
      const league = await deps.leagueRepo.create(input);

      // 2. Create Season 1 (Preseason, Week 1)
      const season = await deps.seasonRepo.create({ leagueId: league.id });
      log.info(
        { leagueId: league.id, seasonId: season.id },
        "created season 1",
      );

      // 3. Get all teams for generation
      const teams = await deps.teamRepo.getAll();
      const teamIds = teams.map((t) => t.id);

      // 4. Generate and persist personnel
      const personnel = deps.personnelGenerator.generate({
        leagueId: league.id,
        seasonId: season.id,
        teamIds,
        rosterSize: league.rosterSize,
      });

      let insertedPlayers: { id: string; teamId: string | null }[] = [];

      if (personnel.players.length > 0) {
        insertedPlayers = await deps.db
          .insert(players)
          .values(personnel.players)
          .returning({ id: players.id, teamId: players.teamId });
      }

      if (personnel.coaches.length > 0) {
        await deps.db.insert(coaches).values(personnel.coaches);
      }
      if (personnel.scouts.length > 0) {
        await deps.db.insert(scouts).values(personnel.scouts);
      }
      if (personnel.frontOfficeStaff.length > 0) {
        await deps.db
          .insert(frontOfficeStaff)
          .values(personnel.frontOfficeStaff);
      }
      if (personnel.draftProspects.length > 0) {
        await deps.db.insert(draftProspects).values(personnel.draftProspects);
      }

      log.info(
        {
          leagueId: league.id,
          players: insertedPlayers.length,
          coaches: personnel.coaches.length,
          scouts: personnel.scouts.length,
          frontOffice: personnel.frontOfficeStaff.length,
          draftProspects: personnel.draftProspects.length,
        },
        "generated personnel",
      );

      // 5. Generate and persist contracts for rostered players
      const generatedContracts = deps.personnelGenerator.generateContracts({
        salaryCap: league.salaryCap,
        players: insertedPlayers,
      });

      if (generatedContracts.length > 0) {
        await deps.db.insert(contracts).values(generatedContracts);
      }

      log.info(
        { leagueId: league.id, contracts: generatedContracts.length },
        "generated contracts",
      );

      // 6. Generate and persist schedule
      const generatedGames = deps.scheduleGenerator.generate({
        seasonId: season.id,
        teams: teams.map((t) => ({
          teamId: t.id,
          conference: t.conference,
          division: t.division,
        })),
        seasonLength: league.seasonLength,
      });

      if (generatedGames.length > 0) {
        await deps.db.insert(games).values(generatedGames);
      }

      log.info(
        { leagueId: league.id, games: generatedGames.length },
        "generated schedule",
      );

      return league;
    },

    async deleteById(id) {
      log.info({ id }, "deleting league");
      const league = await deps.leagueRepo.getById(id);
      if (!league) {
        throw new DomainError("NOT_FOUND", `League ${id} not found`);
      }
      await deps.leagueRepo.deleteById(id);
    },
  };
}
