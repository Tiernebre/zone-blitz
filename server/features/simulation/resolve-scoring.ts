import type { PlayEvent, PlayTag } from "./events.ts";
import type { GameState, PlayerRuntime, TeamRuntime } from "./resolve-play.ts";
import type { SeededRng } from "./rng.ts";
import type { MutableGameState } from "./game-clock.ts";
import { formatClock } from "./game-clock.ts";
import type { SimTeam } from "./simulate-game.ts";
import type { ActiveRosters } from "./simulate-game.ts";
import {
  conversionDecision,
  resolveExtraPoint,
  resolveTwoPointConversion,
} from "./scoring.ts";
import { buildPlayEvent } from "./play-event.ts";

export interface ScoringResult {
  scored: boolean;
  scoringTeamSide?: "home" | "away";
  scoringTeamId?: string;
  points?: number;
  type?: "touchdown" | "return_td" | "safety";
  kickoffSide?: "home" | "away";
  safetyKick?: boolean;
}

export function determineScoringOutcome(
  event: PlayEvent,
  homeTeamId: string,
): ScoringResult {
  if (event.outcome === "touchdown") {
    const isHome = event.offenseTeamId === homeTeamId;
    return {
      scored: true,
      scoringTeamSide: isHome ? "home" : "away",
      scoringTeamId: event.offenseTeamId,
      points: 6,
      type: "touchdown",
      kickoffSide: isHome ? "home" : "away",
    };
  }

  if (event.tags.includes("return_td")) {
    const isHome = event.defenseTeamId === homeTeamId;
    return {
      scored: true,
      scoringTeamSide: isHome ? "home" : "away",
      scoringTeamId: event.defenseTeamId,
      points: 6,
      type: "return_td",
      kickoffSide: isHome ? "home" : "away",
    };
  }

  if (event.outcome === "safety") {
    const isHome = event.offenseTeamId === homeTeamId;
    return {
      scored: true,
      // Defense gets 2 points on a safety
      scoringTeamSide: isHome ? "away" : "home",
      scoringTeamId: isHome ? event.defenseTeamId : event.offenseTeamId,
      points: 2,
      type: "safety",
      // Offense kicks after conceding a safety
      kickoffSide: isHome ? "home" : "away",
      safetyKick: true,
    };
  }

  return { scored: false };
}

export interface ConversionContext {
  gameId: string;
  state: MutableGameState;
  scoringTeamId: string;
  homeTeamId: string;
  home: SimTeam;
  away: SimTeam;
  rosters: ActiveRosters;
  buildTeamRuntime: (
    team: SimTeam,
    rosters: ActiveRosters,
    side: "home" | "away",
  ) => TeamRuntime;
  buildGameState: () => GameState;
  findKicker: (side: "home" | "away") => PlayerRuntime;
}

export function resolveConversion(
  ctx: ConversionContext,
  rng: SeededRng,
): PlayEvent[] {
  const { state, scoringTeamId, homeTeamId, home, away } = ctx;
  const scoringTeam = scoringTeamId === homeTeamId ? home : away;
  const defendingTeam = scoringTeamId === homeTeamId ? away : home;
  const isHome = scoringTeamId === homeTeamId;

  const diff = isHome
    ? state.homeScore - state.awayScore
    : state.awayScore - state.homeScore;
  const choice = conversionDecision(
    diff,
    state.quarter,
    formatClock(state.clock),
    scoringTeam.coachingMods.situationalBonus * 10 + 50,
  );

  const events: PlayEvent[] = [];

  if (choice === "xp") {
    const kicker = ctx.findKicker(isHome ? "home" : "away");
    const made = resolveExtraPoint(kicker, rng);
    const xpEvent = buildPlayEvent({
      gameId: ctx.gameId,
      driveIndex: state.driveIndex,
      playIndex: state.playIndex,
      quarter: state.quarter,
      clock: formatClock(state.clock),
      situation: { down: 1, distance: 0, yardLine: 85 },
      offenseTeamId: scoringTeamId,
      defenseTeamId: scoringTeamId === homeTeamId ? away.teamId : home.teamId,
      call: {
        concept: "extra_point",
        personnel: "special_teams",
        formation: "field_goal",
        motion: "none",
      },
      coverage: {
        front: "field_goal_block",
        coverage: "none",
        pressure: "none",
      },
      participants: [{
        role: "kicker",
        playerId: kicker.playerId,
        tags: made ? ["xp_made"] : ["xp_missed"],
      }],
      outcome: "xp",
      yardage: 0,
      tags: made ? [] : ["xp_missed" as PlayTag],
    });
    events.push(xpEvent);
    state.playIndex++;
    state.globalPlayIndex++;
    if (made) {
      if (isHome) state.homeScore += 1;
      else state.awayScore += 1;
    }
  } else {
    const offense = ctx.buildTeamRuntime(
      scoringTeam,
      ctx.rosters,
      isHome ? "home" : "away",
    );
    const defense = ctx.buildTeamRuntime(
      defendingTeam,
      ctx.rosters,
      isHome ? "away" : "home",
    );
    const conversionEvent = resolveTwoPointConversion(
      ctx.buildGameState(),
      offense,
      defense,
      rng,
    );
    events.push(conversionEvent);
    state.playIndex++;
    state.globalPlayIndex++;
    if (conversionEvent.tags.includes("two_point_conversion")) {
      if (isHome) state.homeScore += 2;
      else state.awayScore += 2;
    }
  }

  return events;
}
