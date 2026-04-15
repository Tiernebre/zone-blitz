import type { PlayEvent, PlayTag } from "./events.ts";
import type { PlayerRuntime } from "./resolve-play.ts";
import type { SeededRng } from "./rng.ts";

export interface KickoffContext {
  gameId: string;
  driveIndex: number;
  playIndex: number;
  quarter: 1 | 2 | 3 | 4 | "OT";
  clock: string;
  kickingTeamId: string;
  receivingTeamId: string;
  kicker: PlayerRuntime;
  returner: PlayerRuntime | undefined;
  coverageUnit: PlayerRuntime[];
  scoreDifferential: number;
}

export interface KickoffResult {
  event: PlayEvent;
  startingYardLine: number;
  isOnsideRecovery: boolean;
  isReturnTouchdown: boolean;
}

const KICKOFF_YARD_LINE = 35;
const TOUCHBACK_YARD_LINE = 25;
const OOB_YARD_LINE = 40;
const OOB_RATE = 0.03;
const SQUIB_RATE = 0.05;
const ONSIDE_RECOVERY_RATE = 0.12;
const ONSIDE_ELECTION_THRESHOLD_SECONDS = 300;

function parseClockSeconds(clock: string): number {
  const [mins, secs] = clock.split(":").map(Number);
  return mins * 60 + secs;
}

function shouldElectOnside(
  scoreDifferential: number,
  quarter: number,
  clock: string,
): boolean {
  if (scoreDifferential >= 0) return false;
  if (quarter < 4) return false;
  return parseClockSeconds(clock) <= ONSIDE_ELECTION_THRESHOLD_SECONDS;
}

function computeTouchbackRate(kickingPower: number): number {
  const normalized = (kickingPower - 30) / 70;
  return Math.max(0.1, Math.min(0.85, 0.2 + normalized * 0.65));
}

function computeReturnDistance(
  returnerSpeed: number,
  returnerElusiveness: number,
  coverageSpeed: number,
  coverageTackling: number,
  rng: SeededRng,
): number {
  const returnerRating = (returnerSpeed * 0.6 + returnerElusiveness * 0.4) /
    100;
  const coverageRating = (coverageSpeed * 0.5 + coverageTackling * 0.5) / 100;

  const baseReturn = 15 + rng.int(0, 20);
  const bonus = (returnerRating - coverageRating) * 15;
  return Math.max(5, Math.round(baseReturn + bonus));
}

function averageAttribute(
  players: PlayerRuntime[],
  attr: "speed" | "tackling",
): number {
  if (players.length === 0) return 50;
  let sum = 0;
  for (const p of players) {
    sum += p.attributes[attr];
  }
  return sum / players.length;
}

export function resolveKickoff(
  ctx: KickoffContext,
  rng: SeededRng,
): KickoffResult {
  const tags: PlayTag[] = [];
  const participants = [
    { role: "kicker", playerId: ctx.kicker.playerId, tags: [] as string[] },
  ];

  const isOnside = shouldElectOnside(
    ctx.scoreDifferential,
    ctx.quarter,
    ctx.clock,
  );

  if (isOnside) {
    tags.push("onside" as PlayTag);

    const recovered = rng.next() < ONSIDE_RECOVERY_RATE;
    const yardLine = KICKOFF_YARD_LINE + rng.int(8, 15);

    const event = buildEvent(ctx, tags, participants, 0);

    return {
      event,
      startingYardLine: recovered ? yardLine : 100 - yardLine,
      isOnsideRecovery: recovered,
      isReturnTouchdown: false,
    };
  }

  const kickingPower = ctx.kicker.attributes.kickingPower;
  const touchbackRate = computeTouchbackRate(kickingPower);

  if (rng.next() < OOB_RATE) {
    const event = buildEvent(ctx, tags, participants, 0);
    return {
      event,
      startingYardLine: OOB_YARD_LINE,
      isOnsideRecovery: false,
      isReturnTouchdown: false,
    };
  }

  if (rng.next() < SQUIB_RATE) {
    const returnDist = rng.int(5, 15);
    if (ctx.returner) {
      participants.push({
        role: "returner",
        playerId: ctx.returner.playerId,
        tags: [],
      });
    }
    const startYard = Math.min(99, Math.max(1, 30 + returnDist));
    const event = buildEvent(ctx, tags, participants, returnDist);
    return {
      event,
      startingYardLine: startYard,
      isOnsideRecovery: false,
      isReturnTouchdown: false,
    };
  }

  if (rng.next() < touchbackRate) {
    const event = buildEvent(ctx, tags, participants, 0);
    return {
      event,
      startingYardLine: TOUCHBACK_YARD_LINE,
      isOnsideRecovery: false,
      isReturnTouchdown: false,
    };
  }

  if (!ctx.returner) {
    const event = buildEvent(ctx, tags, participants, 0);
    return {
      event,
      startingYardLine: TOUCHBACK_YARD_LINE,
      isOnsideRecovery: false,
      isReturnTouchdown: false,
    };
  }

  participants.push({
    role: "returner",
    playerId: ctx.returner.playerId,
    tags: [],
  });

  const covSpeed = averageAttribute(ctx.coverageUnit, "speed");
  const covTackling = averageAttribute(ctx.coverageUnit, "tackling");

  const returnDist = computeReturnDistance(
    ctx.returner.attributes.speed,
    ctx.returner.attributes.elusiveness,
    covSpeed,
    covTackling,
    rng,
  );

  const catchYard = rng.int(2, 8);
  const startYard = Math.min(99, Math.max(1, catchYard + returnDist));

  const returnTDChance = (ctx.returner.attributes.speed / 100) * 0.015 +
    (ctx.returner.attributes.elusiveness / 100) * 0.01;

  if (rng.next() < returnTDChance) {
    tags.push("touchdown");
    const event = buildEvent(ctx, tags, participants, 100 - catchYard);
    return {
      event,
      startingYardLine: 0,
      isOnsideRecovery: false,
      isReturnTouchdown: true,
    };
  }

  const event = buildEvent(ctx, tags, participants, returnDist);
  return {
    event,
    startingYardLine: startYard,
    isOnsideRecovery: false,
    isReturnTouchdown: false,
  };
}

function buildEvent(
  ctx: KickoffContext,
  tags: PlayTag[],
  participants: { role: string; playerId: string; tags: string[] }[],
  yardage: number,
): PlayEvent {
  return {
    gameId: ctx.gameId,
    driveIndex: ctx.driveIndex,
    playIndex: ctx.playIndex,
    quarter: ctx.quarter,
    clock: ctx.clock,
    situation: {
      down: 1,
      distance: 10,
      yardLine: KICKOFF_YARD_LINE,
    },
    offenseTeamId: ctx.kickingTeamId,
    defenseTeamId: ctx.receivingTeamId,
    call: {
      concept: "kickoff",
      personnel: "special_teams",
      formation: "kickoff",
      motion: "none",
    },
    coverage: {
      front: "kick_return",
      coverage: "none",
      pressure: "none",
    },
    participants,
    outcome: "kickoff",
    yardage,
    tags,
  };
}
