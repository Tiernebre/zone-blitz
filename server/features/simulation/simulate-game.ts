import type { SeededRng } from "./rng.ts";
import { createSeededRng } from "./rng.ts";
import type {
  GameResult,
  InjurySeverity,
  PlayEvent,
  PlayTag,
} from "./events.ts";
import type {
  CoachingMods,
  GameState,
  PlayerRuntime,
  TeamRuntime,
} from "./resolve-play.ts";
import type { SchemeFingerprint } from "@zone-blitz/shared";
import { isTwoMinuteDrill, resolvePlay } from "./resolve-play.ts";
import { resolveKickoff } from "./resolve-kickoff.ts";
import type { KickoffContext } from "./resolve-kickoff.ts";
import {
  deriveBoxScore,
  deriveDriveLog,
  deriveInjuryReport,
} from "./derive-game-views.ts";
import {
  conversionDecision,
  resolveExtraPoint,
  resolveTwoPointConversion,
} from "./scoring.ts";
import { resolvePunt } from "./resolve-punt.ts";
import { resolveFieldGoal } from "./resolve-field-goal.ts";
import { resolveFourthDown } from "./resolve-fourth-down.ts";
import { buildPlayEvent } from "./play-event.ts";

export interface SimTeam {
  teamId: string;
  starters: PlayerRuntime[];
  bench: PlayerRuntime[];
  fingerprint: SchemeFingerprint;
  coachingMods: CoachingMods;
}

export interface SimulationInput {
  home: SimTeam;
  away: SimTeam;
  seed: number;
  gameId?: string;
  isPlayoff?: boolean;
}

const QUARTER_SECONDS = 900;
const SECONDS_PER_PLAY = 34.8;
const INJURY_SEVERITIES: InjurySeverity[] = [
  "shake_off",
  "miss_drive",
  "miss_quarter",
  "miss_game",
  "miss_weeks",
  "miss_season",
  "career_ending",
];
const INJURY_WEIGHTS = [0.35, 0.25, 0.15, 0.10, 0.08, 0.05, 0.02];

const OT_SECONDS = 600;
const TIMEOUTS_PER_HALF = 3;
const KNEEL_CLOCK_BURN = 40;
const CLOCK_STOP_RUNOFF = { min: 5, max: 15 } as const;
const TIMEOUT_USAGE = {
  offenseTrailingProb: 0.4,
  defenseLeadingProb: 0.3,
} as const;
const KICKOFF_STARTING_YARD_LINE = 35;

interface MutableGameState {
  quarter: 1 | 2 | 3 | 4 | "OT";
  clock: number;
  homeScore: number;
  awayScore: number;
  possession: "home" | "away";
  yardLine: number;
  down: 1 | 2 | 3 | 4;
  distance: number;
  driveIndex: number;
  playIndex: number;
  globalPlayIndex: number;
  driveStartYardLine: number;
  drivePlays: number;
  driveYards: number;
  homeTimeouts: number;
  awayTimeouts: number;
}

interface ActiveRosters {
  homeActive: PlayerRuntime[];
  awayActive: PlayerRuntime[];
  homeBench: PlayerRuntime[];
  awayBench: PlayerRuntime[];
  injuredPlayerIds: Set<string>;
}

function pickInjurySeverity(rng: SeededRng): InjurySeverity {
  const roll = rng.next();
  let cumulative = 0;
  for (let i = 0; i < INJURY_SEVERITIES.length; i++) {
    cumulative += INJURY_WEIGHTS[i];
    if (roll < cumulative) return INJURY_SEVERITIES[i];
  }
  return "shake_off";
}

function formatClock(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function buildTeamRuntime(
  team: SimTeam,
  rosters: ActiveRosters,
  side: "home" | "away",
): TeamRuntime {
  const active = side === "home" ? rosters.homeActive : rosters.awayActive;
  const available = active.filter(
    (p) => !rosters.injuredPlayerIds.has(p.playerId),
  );
  return {
    fingerprint: team.fingerprint,
    onField: available,
    coachingMods: team.coachingMods,
  };
}

function promoteNextManUp(
  injuredPlayer: PlayerRuntime,
  rosters: ActiveRosters,
  side: "home" | "away",
): void {
  const bench = side === "home" ? rosters.homeBench : rosters.awayBench;
  const active = side === "home" ? rosters.homeActive : rosters.awayActive;

  const replacementIdx = bench.findIndex(
    (p) => p.neutralBucket === injuredPlayer.neutralBucket,
  );
  if (replacementIdx >= 0) {
    const replacement = bench[replacementIdx];
    bench.splice(replacementIdx, 1);
    active.push(replacement);
  }
}

function shouldClockStop(event: PlayEvent): boolean {
  return (
    event.outcome === "pass_incomplete" ||
    event.outcome === "spike" ||
    event.tags.includes("penalty") ||
    event.tags.includes("turnover") ||
    event.tags.includes("timeout") ||
    event.outcome === "touchdown" ||
    event.outcome === "field_goal" ||
    event.outcome === "missed_field_goal" ||
    event.outcome === "punt" ||
    event.outcome === "kickoff" ||
    event.outcome === "safety" ||
    event.tags.includes("return_td")
  );
}

export function simulateGame(input: SimulationInput): GameResult {
  const rng = createSeededRng(input.seed);
  const gameId = input.gameId ?? `game-${input.seed}`;

  const events: PlayEvent[] = [];

  const rosters: ActiveRosters = {
    homeActive: [...input.home.starters],
    awayActive: [...input.away.starters],
    homeBench: [...input.home.bench],
    awayBench: [...input.away.bench],
    injuredPlayerIds: new Set(),
  };

  const state: MutableGameState = {
    quarter: 1,
    clock: QUARTER_SECONDS,
    homeScore: 0,
    awayScore: 0,
    possession: "home",
    yardLine: KICKOFF_STARTING_YARD_LINE,
    down: 1,
    distance: 10,
    driveIndex: 0,
    playIndex: 0,
    globalPlayIndex: 0,
    driveStartYardLine: KICKOFF_STARTING_YARD_LINE,
    drivePlays: 0,
    driveYards: 0,
    homeTimeouts: TIMEOUTS_PER_HALF,
    awayTimeouts: TIMEOUTS_PER_HALF,
  };

  function findPlayerByBucket(
    side: "home" | "away",
    bucket: PlayerRuntime["neutralBucket"],
  ): PlayerRuntime | undefined {
    const active = side === "home" ? rosters.homeActive : rosters.awayActive;
    return active.find(
      (p) =>
        p.neutralBucket === bucket && !rosters.injuredPlayerIds.has(p.playerId),
    );
  }

  function currentOffenseTeamId(): string {
    return state.possession === "home" ? input.home.teamId : input.away.teamId;
  }

  function currentDefenseTeamId(): string {
    return state.possession === "home" ? input.away.teamId : input.home.teamId;
  }

  function startNewDrive(yardLine: number): void {
    state.driveIndex++;
    state.playIndex = 0;
    state.yardLine = yardLine;
    state.down = 1;
    state.distance = 10;
    state.driveStartYardLine = yardLine;
    state.drivePlays = 0;
    state.driveYards = 0;
  }

  function switchPossession(): void {
    state.possession = state.possession === "home" ? "away" : "home";
  }

  function findKicker(side: "home" | "away"): PlayerRuntime {
    const team = side === "home" ? input.home : input.away;
    const active = side === "home" ? rosters.homeActive : rosters.awayActive;
    const available = active.filter(
      (p) => !rosters.injuredPlayerIds.has(p.playerId),
    );
    return (
      available.find((p) => p.neutralBucket === "K") ??
        team.starters.find((p) => p.neutralBucket === "K") ??
        team.starters[0]
    );
  }

  function findReturner(side: "home" | "away"): PlayerRuntime | undefined {
    const active = side === "home" ? rosters.homeActive : rosters.awayActive;
    const available = active.filter(
      (p) => !rosters.injuredPlayerIds.has(p.playerId),
    );
    return (
      available.find((p) => p.neutralBucket === "WR") ??
        available.find((p) => p.neutralBucket === "RB")
    );
  }

  function findCoverageUnit(side: "home" | "away"): PlayerRuntime[] {
    const active = side === "home" ? rosters.homeActive : rosters.awayActive;
    return active
      .filter((p) => !rosters.injuredPlayerIds.has(p.playerId))
      .filter(
        (p) =>
          p.neutralBucket === "LB" ||
          p.neutralBucket === "S" ||
          p.neutralBucket === "CB",
      )
      .slice(0, 4);
  }

  function performKickoff(
    kickingSide: "home" | "away",
    options?: { isSafetyKick?: boolean },
  ): void {
    const receivingSide = kickingSide === "home" ? "away" : "home";
    const kickingTeamId = kickingSide === "home"
      ? input.home.teamId
      : input.away.teamId;
    const receivingTeamId = receivingSide === "home"
      ? input.home.teamId
      : input.away.teamId;

    const kickerScore = kickingSide === "home"
      ? state.homeScore
      : state.awayScore;
    const receiverScore = receivingSide === "home"
      ? state.homeScore
      : state.awayScore;

    const ctx: KickoffContext = {
      gameId,
      driveIndex: state.driveIndex,
      playIndex: state.playIndex,
      quarter: state.quarter,
      clock: formatClock(state.clock),
      kickingTeamId,
      receivingTeamId,
      kicker: findKicker(kickingSide),
      returner: findReturner(receivingSide),
      coverageUnit: findCoverageUnit(kickingSide),
      scoreDifferential: receiverScore - kickerScore,
      isSafetyKick: options?.isSafetyKick,
    };

    const result = resolveKickoff(ctx, rng);
    events.push(result.event);
    state.globalPlayIndex++;

    if (result.isReturnTouchdown) {
      const isReceiverHome = receivingSide === "home";
      if (isReceiverHome) state.homeScore += 6;
      else state.awayScore += 6;

      resolveConversion(receivingTeamId);

      state.possession = kickingSide;
      performKickoff(receivingSide);
      return;
    }

    if (result.isOnsideRecovery) {
      state.possession = kickingSide;
      startNewDrive(result.startingYardLine);
      return;
    }

    state.possession = receivingSide;
    startNewDrive(result.startingYardLine);
  }

  function buildGameState(): GameState {
    return {
      gameId,
      driveIndex: state.driveIndex,
      playIndex: state.playIndex,
      quarter: state.quarter,
      clock: formatClock(state.clock),
      situation: {
        down: state.down,
        distance: state.distance,
        yardLine: state.yardLine,
      },
      offenseTeamId: currentOffenseTeamId(),
      defenseTeamId: currentDefenseTeamId(),
    };
  }

  function processInjury(event: PlayEvent): void {
    if (!event.tags.includes("injury")) return;

    const severity = pickInjurySeverity(rng);
    const severityTag = `injury_${severity}` as PlayTag;
    event.tags.push(severityTag);

    const offensePlayers = event.participants.filter((p) => p.tags.length > 0);
    const injuredParticipant = offensePlayers.length > 0
      ? offensePlayers[rng.int(0, offensePlayers.length - 1)]
      : event.participants.length > 0
      ? event.participants[rng.int(0, event.participants.length - 1)]
      : null;

    if (!injuredParticipant) return;

    injuredParticipant.tags.push("injury", severity);

    if (severity !== "shake_off") {
      rosters.injuredPlayerIds.add(injuredParticipant.playerId);

      const allPlayers = [
        ...input.home.starters,
        ...input.home.bench,
        ...input.away.starters,
        ...input.away.bench,
      ];
      const playerData = allPlayers.find(
        (p) => p.playerId === injuredParticipant.playerId,
      );
      if (playerData) {
        const isHomePlayer = input.home.starters.some(
          (p) => p.playerId === injuredParticipant.playerId,
        ) || input.home.bench.some(
          (p) => p.playerId === injuredParticipant.playerId,
        );
        promoteNextManUp(
          playerData,
          rosters,
          isHomePlayer ? "home" : "away",
        );
      }
    }
  }

  function resolveConversion(scoringTeamId: string): void {
    const scoringTeam = scoringTeamId === input.home.teamId
      ? input.home
      : input.away;
    const defendingTeam = scoringTeamId === input.home.teamId
      ? input.away
      : input.home;
    const isHome = scoringTeamId === input.home.teamId;

    const diff = isHome
      ? state.homeScore - state.awayScore
      : state.awayScore - state.homeScore;
    const choice = conversionDecision(
      diff,
      state.quarter,
      formatClock(state.clock),
      scoringTeam.coachingMods.situationalBonus * 10 + 50,
    );

    if (choice === "xp") {
      const kicker = findKicker(isHome ? "home" : "away");
      const made = resolveExtraPoint(kicker, rng);
      const xpEvent = buildPlayEvent({
        gameId,
        driveIndex: state.driveIndex,
        playIndex: state.playIndex,
        quarter: state.quarter,
        clock: formatClock(state.clock),
        situation: { down: 1, distance: 0, yardLine: 85 },
        offenseTeamId: scoringTeamId,
        defenseTeamId: scoringTeamId === input.home.teamId
          ? input.away.teamId
          : input.home.teamId,
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
      const offense = buildTeamRuntime(
        scoringTeam,
        rosters,
        isHome ? "home" : "away",
      );
      const defense = buildTeamRuntime(
        defendingTeam,
        rosters,
        isHome ? "away" : "home",
      );
      const conversionEvent = resolveTwoPointConversion(
        buildGameState(),
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
  }

  function handleScoring(event: PlayEvent): boolean {
    if (event.outcome === "touchdown") {
      const isHome = event.offenseTeamId === input.home.teamId;
      if (isHome) state.homeScore += 6;
      else state.awayScore += 6;

      resolveConversion(event.offenseTeamId);

      const scoringSide: "home" | "away" = isHome ? "home" : "away";
      performKickoff(scoringSide);
      return true;
    }

    if (event.tags.includes("return_td")) {
      const isHome = event.defenseTeamId === input.home.teamId;
      if (isHome) state.homeScore += 6;
      else state.awayScore += 6;

      resolveConversion(event.defenseTeamId);

      const scoringSide: "home" | "away" = isHome ? "home" : "away";
      performKickoff(scoringSide);
      return true;
    }

    if (event.outcome === "safety") {
      const isHome = event.offenseTeamId === input.home.teamId;
      if (isHome) state.awayScore += 2;
      else state.homeScore += 2;

      const concedingSide: "home" | "away" = isHome ? "home" : "away";
      performKickoff(concedingSide, { isSafetyKick: true });
      return true;
    }

    return false;
  }

  function handleTurnover(event: PlayEvent): boolean {
    if (!event.tags.includes("turnover")) return false;
    if (event.tags.includes("return_td")) return false;

    const turnoverYardLine = Math.max(
      1,
      Math.min(99, state.yardLine + event.yardage),
    );
    switchPossession();
    startNewDrive(100 - turnoverYardLine);
    return true;
  }

  function attemptFieldGoal(): void {
    const kicker = findKicker(state.possession);
    const fgResult = resolveFieldGoal({
      kicker,
      yardLine: state.yardLine,
      rng,
    });

    const participants: PlayEvent["participants"] = [{
      role: "kicker",
      playerId: kicker.playerId,
      tags: [],
    }];

    const fgEvent = buildPlayEvent({
      gameId,
      driveIndex: state.driveIndex,
      playIndex: state.playIndex,
      quarter: state.quarter,
      clock: formatClock(state.clock),
      situation: {
        down: state.down,
        distance: state.distance,
        yardLine: state.yardLine,
      },
      offenseTeamId: currentOffenseTeamId(),
      defenseTeamId: currentDefenseTeamId(),
      call: {
        concept: "field_goal",
        personnel: "special_teams",
        formation: "field_goal",
        motion: "none",
      },
      coverage: {
        front: "field_goal_block",
        coverage: "none",
        pressure: "none",
      },
      participants,
      outcome: fgResult.outcome === "made" ? "field_goal" : "missed_field_goal",
      yardage: 0,
    });

    if (fgResult.blocked) {
      fgEvent.tags.push("blocked_kick");
    }
    if (fgResult.outcome !== "made") {
      fgEvent.tags.push("missed_fg");
    }

    events.push(fgEvent);
    state.drivePlays++;
    state.globalPlayIndex++;
    state.playIndex++;

    if (fgResult.outcome === "made") {
      const isHome = currentOffenseTeamId() === input.home.teamId;
      if (isHome) state.homeScore += 3;
      else state.awayScore += 3;
      const kickingSide: "home" | "away" = isHome ? "home" : "away";
      performKickoff(kickingSide);
    } else {
      switchPossession();
      startNewDrive(fgResult.defenseYardLine);
    }
  }

  function attemptPunt(): void {
    const punterPlayer = findPlayerByBucket(state.possession, "P") ??
      findKicker(state.possession);
    const defenseSide: "home" | "away" = state.possession === "home"
      ? "away"
      : "home";
    const returner = findReturner(defenseSide);
    const coverageUnit = findCoverageUnit(state.possession);

    const puntResult = resolvePunt({
      punter: punterPlayer,
      returner: returner ?? {
        playerId: "unknown-ret",
        neutralBucket: "WR",
        attributes: {} as PlayerRuntime["attributes"],
      },
      coverageUnit,
      yardLine: state.yardLine,
      rng,
    });

    const puntParticipants: PlayEvent["participants"] = [{
      role: "punter",
      playerId: punterPlayer.playerId,
      tags: [],
    }];
    if (
      returner &&
      (puntResult.outcome === "return" || puntResult.outcome === "fair_catch" ||
        puntResult.outcome === "muffed_punt")
    ) {
      puntParticipants.push({
        role: "returner",
        playerId: returner.playerId,
        tags: [],
      });
    }

    const puntTags: PlayTag[] = [];
    if (puntResult.outcome === "muffed_punt") puntTags.push("muff");
    if (puntResult.outcome === "blocked_punt") puntTags.push("blocked_kick");

    const puntEvent = buildPlayEvent({
      gameId,
      driveIndex: state.driveIndex,
      playIndex: state.playIndex,
      quarter: state.quarter,
      clock: formatClock(state.clock),
      situation: {
        down: state.down,
        distance: state.distance,
        yardLine: state.yardLine,
      },
      offenseTeamId: currentOffenseTeamId(),
      defenseTeamId: currentDefenseTeamId(),
      call: {
        concept: "punt",
        personnel: "special_teams",
        formation: "punt",
        motion: "none",
      },
      coverage: {
        front: "punt_return",
        coverage: "none",
        pressure: "none",
      },
      participants: puntParticipants,
      outcome: "punt",
      yardage: puntResult.netYards,
      tags: puntTags,
    });

    events.push(puntEvent);
    state.drivePlays++;
    state.globalPlayIndex++;
    state.playIndex++;

    if (puntResult.outcome === "blocked_punt") {
      switchPossession();
      startNewDrive(100 - state.yardLine);
    } else if (puntResult.outcome === "muffed_punt") {
      switchPossession();
      startNewDrive(100 - puntResult.landingYardLine);
    } else {
      switchPossession();
      startNewDrive(100 - puntResult.landingYardLine);
    }
  }

  function handleFourthDown(): boolean {
    if (state.down !== 4) return false;

    const yardsToEndzone = 100 - state.yardLine;
    const offenseTeam = state.possession === "home" ? input.home : input.away;
    const offenseScore = state.possession === "home"
      ? state.homeScore
      : state.awayScore;
    const defenseScore = state.possession === "home"
      ? state.awayScore
      : state.homeScore;

    const decision = resolveFourthDown({
      yardsToEndzone,
      distance: state.distance,
      scoreDifferential: offenseScore - defenseScore,
      quarter: state.quarter,
      clockSeconds: state.clock,
      aggressiveness: offenseTeam.coachingMods.aggressiveness,
    }, rng);

    if (decision === "go") {
      return false;
    }

    if (decision === "fg") {
      attemptFieldGoal();
      return true;
    }

    attemptPunt();
    return true;
  }

  function advanceDowns(yardage: number): void {
    state.yardLine += yardage;
    state.driveYards += yardage;

    if (state.yardLine <= 0) {
      state.yardLine = 1;
    }

    if (yardage >= state.distance) {
      state.down = 1;
      state.distance = Math.min(10, 100 - state.yardLine);
    } else {
      state.distance -= yardage;
      if (state.distance <= 0) {
        state.down = 1;
        state.distance = Math.min(10, 100 - state.yardLine);
      } else {
        state.down = Math.min(state.down + 1, 4) as 1 | 2 | 3 | 4;
      }
    }
  }

  function applyAcceptedPenalty(event: PlayEvent): void {
    const penalty = event.penalty!;
    const isAgainstOffense = penalty.againstTeamId === currentOffenseTeamId();

    if (isAgainstOffense) {
      const penaltyYards = -Math.min(penalty.yardage, state.yardLine - 1);
      state.yardLine += penaltyYards;
      state.driveYards += penaltyYards;
      if (penalty.phase === "pre_snap") {
        state.distance = Math.min(
          state.distance + penalty.yardage,
          100 - state.yardLine,
        );
      } else {
        state.down = Math.min(state.down + 1, 4) as 1 | 2 | 3 | 4;
        state.distance = Math.min(
          state.distance + penalty.yardage,
          100 - state.yardLine,
        );
      }
    } else {
      const penaltyYards = Math.min(penalty.yardage, 100 - state.yardLine);
      state.yardLine += penaltyYards;
      state.driveYards += penaltyYards;
      if (penalty.automaticFirstDown) {
        state.down = 1;
        state.distance = Math.min(10, 100 - state.yardLine);
      } else {
        state.down = 1;
        state.distance = Math.max(1, state.distance - penalty.yardage);
        if (state.distance <= 0 || penalty.yardage >= state.distance) {
          state.distance = Math.min(10, 100 - state.yardLine);
        }
      }
    }
  }

  function shouldKneel(): boolean {
    if (state.quarter !== 2 && state.quarter !== 4) return false;

    const offenseScore = state.possession === "home"
      ? state.homeScore
      : state.awayScore;
    const defenseScore = state.possession === "home"
      ? state.awayScore
      : state.homeScore;
    if (offenseScore <= defenseScore) return false;

    const downsRemaining = 4 - state.down + 1;
    const clockNeeded = downsRemaining * KNEEL_CLOCK_BURN;
    return state.clock <= clockNeeded && state.clock > 0;
  }

  function emitKneel(): void {
    const kneelEvent = buildPlayEvent({
      gameId,
      driveIndex: state.driveIndex,
      playIndex: state.playIndex,
      quarter: state.quarter,
      clock: formatClock(state.clock),
      situation: {
        down: state.down,
        distance: state.distance,
        yardLine: state.yardLine,
      },
      offenseTeamId: currentOffenseTeamId(),
      defenseTeamId: currentDefenseTeamId(),
      call: {
        concept: "kneel",
        personnel: "victory",
        formation: "under_center",
        motion: "none",
      },
      coverage: {
        front: "victory",
        coverage: "none",
        pressure: "none",
      },
      outcome: "kneel",
      yardage: -1,
      tags: ["victory_formation"],
    });

    events.push(kneelEvent);
    state.drivePlays++;
    state.globalPlayIndex++;
    state.playIndex++;
    state.clock -= KNEEL_CLOCK_BURN;
    state.down = Math.min(state.down + 1, 4) as 1 | 2 | 3 | 4;
    state.distance += 1;
    state.yardLine -= 1;
    if (state.yardLine < 1) state.yardLine = 1;
  }

  function trySpendTimeout(): boolean {
    const twoMinute = isTwoMinuteDrill(state.quarter, formatClock(state.clock));
    if (!twoMinute) return false;

    const offenseTimeouts = state.possession === "home"
      ? state.homeTimeouts
      : state.awayTimeouts;
    const defenseTimeouts = state.possession === "home"
      ? state.awayTimeouts
      : state.homeTimeouts;

    const offenseScore = state.possession === "home"
      ? state.homeScore
      : state.awayScore;
    const defenseScore = state.possession === "home"
      ? state.awayScore
      : state.homeScore;

    const offenseTrailing = offenseScore < defenseScore;
    const defenseLeading = defenseScore > offenseScore;

    if (
      offenseTrailing && offenseTimeouts > 0 &&
      rng.next() < TIMEOUT_USAGE.offenseTrailingProb
    ) {
      if (state.possession === "home") state.homeTimeouts--;
      else state.awayTimeouts--;
      return true;
    }

    if (
      defenseLeading && defenseTimeouts > 0 &&
      rng.next() < TIMEOUT_USAGE.defenseLeadingProb
    ) {
      if (state.possession === "home") state.awayTimeouts--;
      else state.homeTimeouts--;
      return true;
    }

    return false;
  }

  function runPlay(): boolean {
    if (shouldKneel()) {
      emitKneel();
      return false;
    }

    if (handleFourthDown()) return true;

    const isFourthDownAttempt = state.down === 4;

    const offenseTeam = state.possession === "home" ? input.home : input.away;
    const defenseTeam = state.possession === "home" ? input.away : input.home;

    const offense = buildTeamRuntime(offenseTeam, rosters, state.possession);
    const defense = buildTeamRuntime(
      defenseTeam,
      rosters,
      state.possession === "home" ? "away" : "home",
    );

    const gameState = buildGameState();
    const twoMinute = isTwoMinuteDrill(state.quarter, formatClock(state.clock));
    const event = resolvePlay(gameState, offense, defense, rng, { twoMinute });

    if (isFourthDownAttempt) {
      event.tags.push("fourth_down_attempt");
    }

    if (twoMinute) {
      const usedTimeout = trySpendTimeout();
      if (usedTimeout) {
        event.tags.push("timeout");
      }
    }

    processInjury(event);
    events.push(event);

    state.drivePlays++;
    state.globalPlayIndex++;
    state.playIndex++;

    if (!shouldClockStop(event)) {
      state.clock -= SECONDS_PER_PLAY;
    } else {
      state.clock -= rng.int(CLOCK_STOP_RUNOFF.min, CLOCK_STOP_RUNOFF.max);
    }

    if (event.penalty?.accepted && !event.tags.includes("return_td")) {
      applyAcceptedPenalty(event);
      return false;
    }

    if (handleScoring(event)) return true;
    if (handleTurnover(event)) return true;

    advanceDowns(event.yardage);

    // Turnover on downs: 4th-down go-for-it failed to convert
    if (isFourthDownAttempt && state.down !== 1) {
      const turnoverYardLine = Math.max(
        1,
        Math.min(99, state.yardLine),
      );
      switchPossession();
      startNewDrive(100 - turnoverYardLine);
      return true;
    }

    return false;
  }

  performKickoff("home");

  for (
    let q = 1 as 1 | 2 | 3 | 4;
    q <= 4;
    q = (q + 1) as 1 | 2 | 3 | 4
  ) {
    state.quarter = q;
    state.clock = QUARTER_SECONDS;

    if (q === 3) {
      state.homeTimeouts = TIMEOUTS_PER_HALF;
      state.awayTimeouts = TIMEOUTS_PER_HALF;
      const secondHalfKicker: "home" | "away" = state.possession === "home"
        ? "home"
        : "away";
      performKickoff(secondHalfKicker);
    }

    while (state.clock > 0) {
      runPlay();
      if (state.clock <= 0) break;
    }
  }

  if (state.homeScore === state.awayScore) {
    const isPlayoff = input.isPlayoff ?? false;
    state.quarter = "OT";
    state.clock = OT_SECONDS;

    const otCoinFlip: "home" | "away" = rng.next() < 0.5 ? "home" : "away";
    state.possession = otCoinFlip;
    performKickoff(otCoinFlip === "home" ? "away" : "home");

    const scoreBeforeOt = { home: state.homeScore, away: state.awayScore };
    let otDriveCount = 0;
    let otOver = false;

    while (!otOver) {
      const driveStartScore = { home: state.homeScore, away: state.awayScore };
      const driveStartDriveIndex = state.driveIndex;

      while (state.clock > 0 && state.driveIndex === driveStartDriveIndex) {
        runPlay();
        if (state.clock <= 0) break;
      }

      otDriveCount++;

      if (state.homeScore !== state.awayScore) {
        otOver = true;
        break;
      }

      if (!isPlayoff) {
        const firstDriveWasTd = otDriveCount === 1 &&
          (driveStartScore.home !== state.homeScore ||
            driveStartScore.away !== state.awayScore) &&
          (state.homeScore - scoreBeforeOt.home >= 6 ||
            state.awayScore - scoreBeforeOt.away >= 6);

        if (firstDriveWasTd) {
          otOver = true;
          break;
        }

        if (otDriveCount >= 2 || state.clock <= 0) {
          otOver = true;
          break;
        }
      } else {
        if (state.clock <= 0) {
          state.clock = OT_SECONDS;
          performKickoff(rng.next() < 0.5 ? "home" : "away");
        }
      }
    }
  }

  return {
    gameId,
    seed: input.seed,
    finalScore: { home: state.homeScore, away: state.awayScore },
    events,
    boxScore: deriveBoxScore(events, input.home.teamId, input.away.teamId),
    driveLog: deriveDriveLog(events),
    injuryReport: deriveInjuryReport(events),
  };
}
