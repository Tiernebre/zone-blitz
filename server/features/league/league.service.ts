import { DomainError } from "@zone-blitz/shared";
import type pino from "pino";
import type { LeagueRepository } from "./league.repository.interface.ts";
import type { LeagueService } from "./league.service.interface.ts";
import type { SeasonService } from "../season/season.service.interface.ts";
import type { TeamService } from "../team/team.service.interface.ts";
import type { PersonnelService } from "../personnel/personnel.service.interface.ts";
import type { ScheduleService } from "../schedule/schedule.service.interface.ts";

export function createLeagueService(deps: {
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
          return {
            ...league,
            currentSeason: current
              ? { year: current.year, phase: current.phase, week: current.week }
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

      const league = await deps.leagueRepo.create(input);

      const season = await deps.seasonService.create({ leagueId: league.id });
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
      });

      await deps.scheduleService.generate({
        seasonId: season.id,
        teams: teams.map((t) => ({
          teamId: t.id,
          conference: t.conference,
          division: t.division,
        })),
        seasonLength: league.seasonLength,
      });

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
