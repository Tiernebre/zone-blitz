import { DomainError } from "@zone-blitz/shared";
import type pino from "pino";
import type { TransactionRunner } from "../../db/transaction-runner.ts";
import type { LeagueRepository } from "./league.repository.interface.ts";
import type { LeagueService } from "./league.service.interface.ts";
import type { SeasonService } from "../season/season.service.interface.ts";
import type { TeamService } from "../team/team.service.interface.ts";
import type { PersonnelService } from "../personnel/personnel.service.interface.ts";
import type { ScheduleService } from "../schedule/schedule.service.interface.ts";

export function createLeagueService(deps: {
  txRunner: TransactionRunner;
  leagueRepo: LeagueRepository;
  seasonService: SeasonService;
  teamService: TeamService;
  personnelService: PersonnelService;
  scheduleService: ScheduleService;
  log: pino.Logger;
}): LeagueService {
  const log = deps.log.child({ module: "league.service" });

  return {
    async getAll() {
      log.debug("fetching all leagues");
      const leagues = await deps.leagueRepo.getAll();
      return await Promise.all(
        leagues.map(async (league) => {
          const seasons = await deps.seasonService.getByLeagueId(league.id);
          const current = seasons.reduce<typeof seasons[number] | undefined>(
            (latest, season) =>
              !latest || season.year > latest.year ? season : latest,
            undefined,
          );
          const userTeam = league.userTeamId
            ? await deps.teamService.getById(league.userTeamId)
            : null;
          return {
            ...league,
            currentSeason: current
              ? {
                year: current.year,
                phase: current.phase,
                offseasonStage: current.offseasonStage,
                week: current.week,
              }
              : null,
            userTeam: userTeam
              ? {
                id: userTeam.id,
                name: userTeam.name,
                city: userTeam.city,
                abbreviation: userTeam.abbreviation,
                primaryColor: userTeam.primaryColor,
              }
              : null,
          };
        }),
      );
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

      const teams = await deps.teamService.getAll();
      if (teams.length === 0) {
        throw new DomainError(
          "PRECONDITION_FAILED",
          "Cannot create a league with no teams. Run `deno task db:seed` to seed default teams.",
        );
      }

      return await deps.txRunner.run(async (tx) => {
        const league = await deps.leagueRepo.create(input, tx);

        const season = await deps.seasonService.create(
          { leagueId: league.id },
          tx,
        );
        log.info(
          { leagueId: league.id, seasonId: season.id },
          "created season 1",
        );

        await deps.personnelService.generate({
          leagueId: league.id,
          seasonId: season.id,
          teamIds: teams.map((t) => t.id),
          rosterSize: league.rosterSize,
          salaryCap: league.salaryCap,
        }, tx);

        await deps.scheduleService.generate({
          seasonId: season.id,
          seasonLength: league.seasonLength,
          teams: teams.map((t) => ({
            teamId: t.id,
            conference: t.conference,
            division: t.division,
          })),
        }, tx);

        return league;
      });
    },

    async assignUserTeam(id, userTeamId) {
      log.info({ id, userTeamId }, "assigning user team to league");
      const league = await deps.leagueRepo.getById(id);
      if (!league) {
        throw new DomainError("NOT_FOUND", `League ${id} not found`);
      }
      await deps.teamService.getById(userTeamId);
      const updated = await deps.leagueRepo.updateUserTeam(id, userTeamId);
      if (!updated) {
        throw new DomainError("NOT_FOUND", `League ${id} not found`);
      }
      return updated;
    },

    async touchLastPlayed(id) {
      log.debug({ id }, "touching league last played");
      const updated = await deps.leagueRepo.touchLastPlayed(id);
      if (!updated) {
        throw new DomainError("NOT_FOUND", `League ${id} not found`);
      }
      return updated;
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
