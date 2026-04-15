import type { SeededRng } from "./rng.ts";
import { createSeededRng } from "./rng.ts";
import type {
  BoxScore,
  DriveResult,
  DriveSummary,
  GameResult,
  InjuryEntry,
  InjurySeverity,
  PlayEvent,
  PlayTag,
  TeamBoxScore,
} from "./events.ts";
import type {
  CoachingMods,
  GameState,
  PlayerRuntime,
  TeamRuntime,
} from "./resolve-play.ts";
import type { SchemeFingerprint } from "@zone-blitz/shared";
import { resolvePlay } from "./resolve-play.ts";

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

function makeEmptyTeamBoxScore(): TeamBoxScore {
  return {
    totalYards: 0,
    passingYards: 0,
    rushingYards: 0,
    turnovers: 0,
    sacks: 0,
    penalties: 0,
  };
}

function shouldClockStop(event: PlayEvent): boolean {
  return (
    event.outcome === "pass_incomplete" ||
    event.tags.includes("penalty") ||
    event.tags.includes("turnover") ||
    event.outcome === "touchdown" ||
    event.outcome === "field_goal" ||
    event.outcome === "punt"
  );
}

export function simulateGame(input: SimulationInput): GameResult {
  const rng = createSeededRng(input.seed);
  const gameId = input.gameId ?? `game-${input.seed}`;

  const events: PlayEvent[] = [];
  const driveLog: DriveSummary[] = [];
  const injuryReport: InjuryEntry[] = [];
  const boxScore: BoxScore = {
    home: makeEmptyTeamBoxScore(),
    away: makeEmptyTeamBoxScore(),
  };

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
    possession: "away",
    yardLine: 25,
    down: 1,
    distance: 10,
    driveIndex: 0,
    playIndex: 0,
    globalPlayIndex: 0,
    driveStartYardLine: 25,
    drivePlays: 0,
    driveYards: 0,
  };

  function currentOffenseTeamId(): string {
    return state.possession === "home" ? input.home.teamId : input.away.teamId;
  }

  function currentDefenseTeamId(): string {
    return state.possession === "home" ? input.away.teamId : input.home.teamId;
  }

  function endDrive(result: DriveResult): void {
    driveLog.push({
      driveIndex: state.driveIndex,
      offenseTeamId: currentOffenseTeamId(),
      startYardLine: state.driveStartYardLine,
      plays: state.drivePlays,
      yards: state.driveYards,
      result,
    });
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

  function updateBoxScore(event: PlayEvent): void {
    const isHome = event.offenseTeamId === input.home.teamId;
    const offenseBox = isHome ? boxScore.home : boxScore.away;
    const defenseBox = isHome ? boxScore.away : boxScore.home;

    if (event.outcome === "pass_complete") {
      offenseBox.passingYards += event.yardage;
      offenseBox.totalYards += event.yardage;
    } else if (event.outcome === "rush") {
      offenseBox.rushingYards += event.yardage;
      offenseBox.totalYards += event.yardage;
    } else if (event.outcome === "sack") {
      offenseBox.passingYards += event.yardage;
      offenseBox.totalYards += event.yardage;
    } else if (event.outcome === "touchdown") {
      offenseBox.totalYards += event.yardage;
    }

    if (event.tags.includes("turnover")) {
      offenseBox.turnovers++;
    }
    if (event.tags.includes("sack")) {
      defenseBox.sacks++;
    }
    if (event.tags.includes("penalty")) {
      offenseBox.penalties++;
    }
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

    injuryReport.push({
      playerId: injuredParticipant.playerId,
      playIndex: event.playIndex,
      driveIndex: event.driveIndex,
      quarter: event.quarter,
      severity,
    });

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

  function handleScoring(event: PlayEvent): boolean {
    if (event.outcome === "touchdown") {
      const isHome = event.offenseTeamId === input.home.teamId;
      if (isHome) state.homeScore += 7;
      else state.awayScore += 7;

      endDrive("touchdown");
      switchPossession();
      startNewDrive(25);
      return true;
    }

    if (event.tags.includes("safety")) {
      const isHome = event.offenseTeamId === input.home.teamId;
      if (isHome) state.awayScore += 2;
      else state.homeScore += 2;

      endDrive("safety");
      switchPossession();
      startNewDrive(25);
      return true;
    }

    return false;
  }

  function handleTurnover(event: PlayEvent): boolean {
    if (!event.tags.includes("turnover")) return false;

    endDrive("turnover");
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
        endDrive("field_goal");
        switchPossession();
        startNewDrive(25);
      } else {
        fgEvent.outcome = "pass_incomplete" as typeof fgEvent.outcome;
        fgEvent.tags.push("penalty");
        events.push(fgEvent);
        state.drivePlays++;
        state.globalPlayIndex++;
        state.playIndex++;
        endDrive("field_goal");
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

    endDrive("punt");
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
    updateBoxScore(event);

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

  for (
    let q = 1 as 1 | 2 | 3 | 4;
    q <= 4;
    q = (q + 1) as 1 | 2 | 3 | 4
  ) {
    state.quarter = q;
    state.clock = QUARTER_SECONDS;

    if (q === 3) {
      endDrive("end_of_half");
      switchPossession();
      const secondHalfReceiver = state.possession;
      state.possession = secondHalfReceiver;
      startNewDrive(25);
    }

    while (state.clock > 0) {
      runPlay();
      if (state.clock <= 0) break;
    }
  }

  if (state.drivePlays > 0) {
    endDrive("end_of_half");
  }

  return {
    gameId,
    seed: input.seed,
    finalScore: { home: state.homeScore, away: state.awayScore },
    events,
    boxScore,
    driveLog,
    injuryReport,
  };
}
