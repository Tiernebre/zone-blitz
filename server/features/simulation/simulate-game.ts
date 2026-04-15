import type { SeededRng } from "./rng.ts";
import { createSeededRng } from "./rng.ts";
import type {
  GameResult,
  InjurySeverity,
  PlayEvent,
  PlayOutcome,
  PlayTag,
} from "./events.ts";
import type {
  CoachingMods,
  GameState,
  PlayerRuntime,
  TeamRuntime,
} from "./resolve-play.ts";
import type { SchemeFingerprint } from "@zone-blitz/shared";
import { resolvePlay } from "./resolve-play.ts";
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
}

const QUARTER_SECONDS = 900;
const SECONDS_PER_PLAY = 35;
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

interface MutableGameState {
  quarter: 1 | 2 | 3 | 4;
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

function getFieldGoalProbability(yardLine: number): number {
  const distance = 100 - yardLine + 17;
  if (distance < 30) return 0.95;
  if (distance < 40) return 0.85;
  if (distance < 50) return 0.75;
  return 0.55;
}

function getPuntDistance(rng: SeededRng): number {
  return rng.int(35, 55);
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
    event.tags.includes("penalty") ||
    event.tags.includes("turnover") ||
    event.outcome === "touchdown" ||
    event.outcome === "field_goal" ||
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
    yardLine: 35,
    down: 1,
    distance: 10,
    driveIndex: 0,
    playIndex: 0,
    globalPlayIndex: 0,
    driveStartYardLine: 35,
    drivePlays: 0,
    driveYards: 0,
  };

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

  function performKickoff(kickingSide: "home" | "away"): void {
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
    };

    const result = resolveKickoff(ctx, rng);
    events.push(result.event);
    state.globalPlayIndex++;

    if (result.isReturnTouchdown) {
      const isReceiverHome = receivingSide === "home";
      if (isReceiverHome) state.homeScore += 7;
      else state.awayScore += 7;

      state.possession = kickingSide;
      startNewDrive(25);
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
      const xpEvent: PlayEvent = {
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
        outcome: "xp" as PlayOutcome,
        yardage: 0,
        tags: made ? [] : ["xp_missed" as PlayTag],
      };
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
      performKickoff(concedingSide);
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

  function handleFourthDown(): boolean {
    if (state.down !== 4) return false;

    const yardsToEndzone = 100 - state.yardLine;
    const fgDistance = yardsToEndzone + 17;

    if (yardsToEndzone <= 2) {
      return false;
    }

    if (fgDistance <= 55 && state.yardLine >= 45) {
      const prob = getFieldGoalProbability(state.yardLine);
      const fgEvent: PlayEvent = {
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
        participants: [],
        outcome: "field_goal",
        yardage: 0,
        tags: [],
      };

      if (rng.next() < prob) {
        const isHome = currentOffenseTeamId() === input.home.teamId;
        if (isHome) state.homeScore += 3;
        else state.awayScore += 3;
        events.push(fgEvent);
        state.drivePlays++;
        state.globalPlayIndex++;
        state.playIndex++;
        const kickingSide: "home" | "away" = isHome ? "home" : "away";
        performKickoff(kickingSide);
      } else {
        fgEvent.outcome = "pass_incomplete" as typeof fgEvent.outcome;
        fgEvent.tags.push("penalty");
        events.push(fgEvent);
        state.drivePlays++;
        state.globalPlayIndex++;
        state.playIndex++;
        switchPossession();
        startNewDrive(100 - state.yardLine);
      }
      return true;
    }

    const puntDistance = getPuntDistance(rng);
    let landingSpot = state.yardLine + puntDistance;
    if (landingSpot >= 100) {
      landingSpot = 80;
    }

    const puntEvent: PlayEvent = {
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
      participants: [],
      outcome: "punt",
      yardage: puntDistance,
      tags: [],
    };

    events.push(puntEvent);
    state.drivePlays++;
    state.globalPlayIndex++;
    state.playIndex++;

    switchPossession();
    startNewDrive(100 - landingSpot);
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

  function runPlay(): boolean {
    const offenseTeam = state.possession === "home" ? input.home : input.away;
    const defenseTeam = state.possession === "home" ? input.away : input.home;

    const offense = buildTeamRuntime(offenseTeam, rosters, state.possession);
    const defense = buildTeamRuntime(
      defenseTeam,
      rosters,
      state.possession === "home" ? "away" : "home",
    );

    const gameState = buildGameState();
    const event = resolvePlay(gameState, offense, defense, rng);

    processInjury(event);
    events.push(event);

    state.drivePlays++;
    state.globalPlayIndex++;
    state.playIndex++;

    if (!shouldClockStop(event)) {
      state.clock -= SECONDS_PER_PLAY;
    } else {
      state.clock -= rng.int(5, 15);
    }

    if (handleScoring(event)) return true;
    if (handleTurnover(event)) return true;

    advanceDowns(event.yardage);

    if (handleFourthDown()) return true;

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
