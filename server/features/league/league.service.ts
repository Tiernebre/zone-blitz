import { deriveDefaultSeasonLength, DomainError } from "@zone-blitz/shared";
import type pino from "pino";
import type { TransactionRunner } from "../../db/transaction-runner.ts";
import type { LeagueRepository } from "./league.repository.interface.ts";
import type { LeagueService } from "./league.service.interface.ts";
import type { SeasonService } from "../season/season.service.interface.ts";
import type { TeamService } from "../team/team.service.interface.ts";
import type { FranchiseService } from "../franchise/franchise.service.interface.ts";
import type { PersonnelService } from "../personnel/personnel.service.interface.ts";
import type { ScheduleService } from "../schedule/schedule.service.interface.ts";
import type { LeagueClockRepository } from "../league-clock/league-clock.repository.ts";

const FOUNDING_TEAM_COUNT = 8;
const FIRST_GENESIS_PHASE = "genesis_charter";

export function createLeagueService(deps: {
  txRunner: TransactionRunner;
  leagueRepo: LeagueRepository;
  seasonService: SeasonService;
  teamService: TeamService;
  franchiseService: FranchiseService;
  personnelService: PersonnelService;
  scheduleService: ScheduleService;
  leagueClockRepo: LeagueClockRepository;
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
      log.info({ name: input.name }, "creating league shell");

      const franchises = await deps.franchiseService.getAll();

      if (franchises.length !== FOUNDING_TEAM_COUNT) {
        throw new DomainError(
          "PRECONDITION_FAILED",
          `Expected ${FOUNDING_TEAM_COUNT} founding franchises but found ${franchises.length}. Run \`deno task db:seed\` to seed founding franchises.`,
        );
      }

      return await deps.txRunner.run(async (tx) => {
        const league = await deps.leagueRepo.create(
          { name: input.name },
          tx,
        );

        const teams = await deps.teamService.createMany(
          franchises.map((f) => ({
            leagueId: league.id,
            franchiseId: f.id,
            name: f.name,
            cityId: f.cityId,
            abbreviation: f.abbreviation,
            primaryColor: f.primaryColor,
            secondaryColor: f.secondaryColor,
            accentColor: f.accentColor,
            conference: f.conference,
            division: f.division,
          })),
          tx,
        );

        log.info(
          { leagueId: league.id, teamCount: teams.length },
          "created league shell with teams",
        );

        return { league, teams };
      });
    },

    async found(leagueId) {
      log.info({ leagueId }, "founding league");

      const league = await deps.leagueRepo.getById(leagueId);
      if (!league) {
        throw new DomainError("NOT_FOUND", `League ${leagueId} not found`);
      }

      const existingClock = await deps.leagueClockRepo.getByLeagueId(leagueId);
      if (existingClock) {
        throw new DomainError(
          "ALREADY_FOUNDED",
          `League ${leagueId} has already been founded`,
        );
      }

      const teams = await deps.teamService.getByLeagueId(leagueId);
      const teamIds = teams.map((t) => t.id);
      const seasonLength = deriveDefaultSeasonLength(teamIds.length);

      return await deps.txRunner.run(async (tx) => {
        const season = await deps.seasonService.create(
          { leagueId },
          tx,
        );
        log.info(
          { leagueId, seasonId: season.id },
          "created season 1",
        );

        const personnelResult = await deps.personnelService.generate(
          {
            leagueId,
            seasonId: season.id,
            teamIds,
            rosterSize: league.rosterSize,
            salaryCap: league.salaryCap,
          },
          tx,
        );

        await deps.scheduleService.generate(
          {
            seasonId: season.id,
            seasonLength,
            teams: teams.map((t) => ({
              teamId: t.id,
              conference: t.conference,
              division: t.division,
            })),
          },
          tx,
        );

        await deps.leagueClockRepo.upsert(
          {
            leagueId,
            seasonYear: 1,
            phase: FIRST_GENESIS_PHASE,
            stepIndex: 0,
            advancedByUserId: null,
          },
          tx,
        );

        log.info(
          {
            leagueId,
            seasonId: season.id,
            playerCount: personnelResult.playerCount,
            coachCount: personnelResult.coachCount,
            scoutCount: personnelResult.scoutCount,
          },
          "league founding complete",
        );

        return {
          leagueId,
          seasonId: season.id,
          playerCount: personnelResult.playerCount,
          coachCount: personnelResult.coachCount,
          scoutCount: personnelResult.scoutCount,
        };
      });
    },

    async getTeams(leagueId) {
      log.debug({ leagueId }, "fetching teams for league");
      const league = await deps.leagueRepo.getById(leagueId);
      if (!league) {
        throw new DomainError("NOT_FOUND", `League ${leagueId} not found`);
      }
      return await deps.teamService.getByLeagueId(leagueId);
    },

    async assignUserTeam(id, userTeamId) {
      log.info({ id, userTeamId }, "assigning user team to league");
      const league = await deps.leagueRepo.getById(id);
      if (!league) {
        throw new DomainError("NOT_FOUND", `League ${id} not found`);
      }
      const team = await deps.teamService.getById(userTeamId);
      if (team.leagueId !== id) {
        throw new DomainError(
          "INVALID_INPUT",
          `Team ${userTeamId} does not belong to league ${id}`,
        );
      }
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
