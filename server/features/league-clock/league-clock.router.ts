import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { castAdvanceVoteSchema } from "@zone-blitz/shared";
import type { LeagueClockService } from "./league-clock.service.ts";
import type { AppEnv } from "../../env.ts";
import type { TeamService } from "../team/team.service.interface.ts";
import type { CoachesService } from "../coaches/coaches.service.interface.ts";

export interface LeagueClockRouterDeps {
  teamService: TeamService;
  coachesService: CoachesService;
}

async function resolveAllTeamsHaveStaff(
  leagueId: string,
  deps: LeagueClockRouterDeps,
): Promise<boolean> {
  const teams = await deps.teamService.getByLeagueId(leagueId);
  for (const team of teams) {
    const staff = await deps.coachesService.getStaffTree(leagueId, team.id);
    if (staff.length === 0) return false;
  }
  return true;
}

export function createLeagueClockRouter(
  service: LeagueClockService,
  deps: LeagueClockRouterDeps,
) {
  return new Hono<AppEnv>()
    .get("/:leagueId", async (c) => {
      const leagueId = c.req.param("leagueId");
      const state = await service.getClockState(leagueId);
      return c.json(state);
    })
    .post("/:leagueId/advance", async (c) => {
      const leagueId = c.req.param("leagueId");
      const user = c.get("user");
      const body = await c.req.json();

      const actor = {
        userId: user?.id ?? "",
        isCommissioner: body.isCommissioner ?? false,
        overrideReason: body.overrideReason,
      };

      const allTeamsHaveStaff = await resolveAllTeamsHaveStaff(
        leagueId,
        deps,
      );

      const result = await service.advance(
        leagueId,
        actor,
        { ...body.gateState, allTeamsHaveStaff },
      );

      return c.json(result);
    })
    .post(
      "/:leagueId/votes",
      zValidator("json", castAdvanceVoteSchema),
      async (c) => {
        const { teamId } = c.req.valid("json");
        const result = await service.castVote(
          c.req.param("leagueId"),
          teamId,
        );
        return c.json(result, 201);
      },
    );
}
