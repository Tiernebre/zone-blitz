import type {
  BoxScore,
  DriveSummary,
  GameResult,
  InjuryEntry,
  InjurySeverity,
  PlayEvent,
} from "./events.ts";
import type {
  GameState,
  PlayerRuntime,
  Situation,
  TeamRuntime,
} from "./resolve-play.ts";
import { resolvePlay } from "./resolve-play.ts";
import { createSeededRng } from "./rng.ts";
import type { SeededRng } from "./rng.ts";

export interface SimulateGameInput {
  gameId: string;
  home: {
    teamId: string;
    roster: TeamRuntime;
  };
  away: {
    teamId: string;
    roster: TeamRuntime;
  };
  seed: number;
}

const QUARTER_SECONDS = 15 * 60;
const PLAY_CLOCK_SECONDS_MIN = 20;
const PLAY_CLOCK_SECONDS_MAX = 40;
const FIELD_GOAL_MAX_YARD_LINE = 55;
const TOUCHBACK_YARD_LINE = 25;

const INJURY_SEVERITIES: InjurySeverity[] = [
  "shake_off",
  "miss_drive",
  "miss_quarter",
  "miss_game",
  "miss_weeks",
  "miss_season",
  "career_ending",
];

const INJURY_SEVERITY_WEIGHTS = [0.40, 0.25, 0.15, 0.10, 0.05, 0.04, 0.01];

interface DriveState {
  teamId: string;
  startYardLine: number;
  plays: number;
  yards: number;
}

interface ActiveInjury {
  playerId: string;
  severity: InjurySeverity;
  driveIndex: number;
  quarter: 1 | 2 | 3 | 4 | "OT";
}

function formatClock(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${String(minutes).padStart(2, "0")}:${
    String(seconds).padStart(2, "0")
  }`;
}

function rollInjurySeverity(rng: SeededRng): InjurySeverity {
  const roll = rng.next();
  let cumulative = 0;
  for (let i = 0; i < INJURY_SEVERITIES.length; i++) {
    cumulative += INJURY_SEVERITY_WEIGHTS[i];
    if (roll < cumulative) return INJURY_SEVERITIES[i];
  }
  return "shake_off";
}

function isPlayerAvailable(
  playerId: string,
  activeInjuries: ActiveInjury[],
  currentDriveIndex: number,
  currentQuarter: 1 | 2 | 3 | 4 | "OT",
): boolean {
  for (const injury of activeInjuries) {
    if (injury.playerId !== playerId) continue;

    switch (injury.severity) {
      case "shake_off":
        continue;
      case "miss_drive":
        if (currentDriveIndex <= injury.driveIndex) return false;
        continue;
      case "miss_quarter":
        if (currentQuarter === injury.quarter) return false;
        continue;
      case "miss_game":
      case "miss_weeks":
      case "miss_season":
      case "career_ending":
        return false;
    }
  }
  return true;
}

function filterAvailablePlayers(
  roster: TeamRuntime,
  activeInjuries: ActiveInjury[],
  driveIndex: number,
  quarter: 1 | 2 | 3 | 4 | "OT",
): TeamRuntime {
  return {
    ...roster,
    onField: roster.onField.filter((p) =>
      isPlayerAvailable(p.playerId, activeInjuries, driveIndex, quarter)
    ),
  };
}

function shouldPunt(situation: Situation, yardLine: number): boolean {
  if (situation.down !== 4) return false;
  if (yardLine >= FIELD_GOAL_MAX_YARD_LINE) return false;
  return situation.distance > 3 || yardLine < 40;
}

function shouldAttemptFieldGoal(
  situation: Situation,
  yardLine: number,
): boolean {
  if (situation.down !== 4) return false;
  return yardLine >= FIELD_GOAL_MAX_YARD_LINE;
}

function resolvePunt(
  state: GameState,
  kicker: PlayerRuntime | undefined,
): PlayEvent {
  const participants = kicker
    ? [{ role: "punter", playerId: kicker.playerId, tags: ["punt"] }]
    : [];

  return {
    gameId: state.gameId,
    driveIndex: state.driveIndex,
    playIndex: state.playIndex,
    quarter: state.quarter,
    clock: state.clock,
    situation: state.situation,
    offenseTeamId: state.offenseTeamId,
    defenseTeamId: state.defenseTeamId,
    call: {
      concept: "punt",
      personnel: "special",
      formation: "punt",
      motion: "none",
    },
    coverage: { front: "punt_return", coverage: "none", pressure: "none" },
    participants,
    outcome: "punt",
    yardage: 0,
    tags: [],
  };
}

function resolveFieldGoal(
  state: GameState,
  kicker: PlayerRuntime | undefined,
  rng: SeededRng,
): { event: PlayEvent; made: boolean } {
  const fgDistance = (100 - state.situation.yardLine) + 17;
  let successProb = 1.0 - (fgDistance - 17) * 0.012;
  if (kicker) {
    const accuracy = kicker.attributes.kickingAccuracy ?? 50;
    const power = kicker.attributes.kickingPower ?? 50;
    successProb += (accuracy - 50) * 0.005;
    successProb += (power - 50) * 0.003;
  }
  successProb = Math.max(0.1, Math.min(0.98, successProb));

  const made = rng.next() < successProb;

  const participants = kicker
    ? [{
      role: "kicker",
      playerId: kicker.playerId,
      tags: made ? ["field_goal_made"] : ["field_goal_missed"],
    }]
    : [];

  const tags = made ? [] as const : [] as const;

  return {
    event: {
      gameId: state.gameId,
      driveIndex: state.driveIndex,
      playIndex: state.playIndex,
      quarter: state.quarter,
      clock: state.clock,
      situation: state.situation,
      offenseTeamId: state.offenseTeamId,
      defenseTeamId: state.defenseTeamId,
      call: {
        concept: "field_goal",
        personnel: "special",
        formation: "field_goal",
        motion: "none",
      },
      coverage: {
        front: "field_goal_block",
        coverage: "none",
        pressure: "none",
      },
      participants,
      outcome: "field_goal",
      yardage: 0,
      tags: [...tags],
    },
    made,
  };
}

export function simulateGame(input: SimulateGameInput): GameResult {
  const rng = createSeededRng(input.seed);
  const events: PlayEvent[] = [];
  const injuryReport: InjuryEntry[] = [];
  const activeInjuries: ActiveInjury[] = [];
  const driveSummaries: DriveSummary[] = [];

  let homeScore = 0;
  let awayScore = 0;
  let quarter: 1 | 2 | 3 | 4 | "OT" = 1;
  let clockSeconds = QUARTER_SECONDS;
  let driveIndex = 0;
  let playIndex = 0;

  const homeReceivesSecondHalf = rng.next() < 0.5;
  let possessionTeamId = homeReceivesSecondHalf
    ? input.away.teamId
    : input.home.teamId;

  let currentDrive: DriveState = {
    teamId: possessionTeamId,
    startYardLine: TOUCHBACK_YARD_LINE,
    plays: 0,
    yards: 0,
  };

  let situation: Situation = {
    down: 1,
    distance: 10,
    yardLine: TOUCHBACK_YARD_LINE,
  };

  function getOffenseTeam() {
    return possessionTeamId === input.home.teamId ? input.home : input.away;
  }

  function getDefenseTeam() {
    return possessionTeamId === input.home.teamId ? input.away : input.home;
  }

  function buildGameState(): GameState {
    const offense = getOffenseTeam();
    const defense = getDefenseTeam();
    return {
      gameId: input.gameId,
      driveIndex,
      playIndex,
      quarter,
      clock: formatClock(clockSeconds),
      situation,
      offenseTeamId: offense.teamId,
      defenseTeamId: defense.teamId,
    };
  }

  function findKicker(roster: TeamRuntime): PlayerRuntime | undefined {
    return roster.onField.find((p) => p.neutralBucket === "K");
  }

  function findPunter(roster: TeamRuntime): PlayerRuntime | undefined {
    return roster.onField.find((p) => p.neutralBucket === "P");
  }

  function changePossession(newYardLine: number) {
    driveSummaries.push({
      teamId: currentDrive.teamId,
      startYardLine: currentDrive.startYardLine,
      plays: currentDrive.plays,
      yards: currentDrive.yards,
    } as unknown as DriveSummary);

    possessionTeamId = possessionTeamId === input.home.teamId
      ? input.away.teamId
      : input.home.teamId;

    driveIndex++;

    situation = {
      down: 1,
      distance: 10,
      yardLine: newYardLine,
    };

    currentDrive = {
      teamId: possessionTeamId,
      startYardLine: newYardLine,
      plays: 0,
      yards: 0,
    };
  }

  function handleScoring(offenseTeamId: string, points: number) {
    if (offenseTeamId === input.home.teamId) {
      homeScore += points;
    } else {
      awayScore += points;
    }
  }

  function advanceClock() {
    const elapsed = rng.int(PLAY_CLOCK_SECONDS_MIN, PLAY_CLOCK_SECONDS_MAX);
    clockSeconds -= elapsed;
  }

  function checkQuarterEnd(): boolean {
    if (clockSeconds <= 0) {
      if (quarter === 4 || quarter === "OT") return false;
      if (quarter === 2) {
        quarter = 3;
        clockSeconds = QUARTER_SECONDS;

        driveSummaries.push({
          teamId: currentDrive.teamId,
          startYardLine: currentDrive.startYardLine,
          plays: currentDrive.plays,
          yards: currentDrive.yards,
        } as unknown as DriveSummary);

        possessionTeamId = homeReceivesSecondHalf
          ? input.home.teamId
          : input.away.teamId;

        driveIndex++;
        situation = { down: 1, distance: 10, yardLine: TOUCHBACK_YARD_LINE };
        currentDrive = {
          teamId: possessionTeamId,
          startYardLine: TOUCHBACK_YARD_LINE,
          plays: 0,
          yards: 0,
        };
        return true;
      }
      quarter = (quarter + 1) as 1 | 2 | 3 | 4;
      clockSeconds = QUARTER_SECONDS;
      return true;
    }
    return true;
  }

  function processInjuries(event: PlayEvent) {
    if (!event.tags.includes("injury")) return;

    const eligibleParticipants = event.participants.filter(
      (p) => p.playerId && p.playerId.length > 0,
    );
    if (eligibleParticipants.length === 0) return;

    const injuredParticipant = rng.pick(eligibleParticipants);
    const severity = rollInjurySeverity(rng);

    const entry: InjuryEntry = {
      playerId: injuredParticipant.playerId,
      severity,
      playIndex: event.playIndex,
      driveIndex: event.driveIndex,
      quarter: event.quarter,
    };

    injuryReport.push(entry);
    activeInjuries.push({
      playerId: injuredParticipant.playerId,
      severity,
      driveIndex: event.driveIndex,
      quarter: event.quarter,
    });
  }

  let safetyCounter = 0;
  const MAX_PLAYS = 400;

  while (safetyCounter < MAX_PLAYS) {
    safetyCounter++;

    if (quarter === 4 && clockSeconds <= 0) break;
    if (quarter === "OT" && clockSeconds <= 0) break;
    if (typeof quarter === "number" && quarter > 4) break;

    const offenseTeam = getOffenseTeam();
    const defenseTeam = getDefenseTeam();

    const availableOffense = filterAvailablePlayers(
      offenseTeam.roster,
      activeInjuries,
      driveIndex,
      quarter,
    );
    const availableDefense = filterAvailablePlayers(
      defenseTeam.roster,
      activeInjuries,
      driveIndex,
      quarter,
    );

    const state = buildGameState();

    if (shouldAttemptFieldGoal(situation, situation.yardLine)) {
      const kicker = findKicker(availableOffense);
      const { event, made } = resolveFieldGoal(state, kicker, rng);
      events.push(event);
      currentDrive.plays++;
      playIndex++;

      if (made) {
        handleScoring(offenseTeam.teamId, 3);
        changePossession(TOUCHBACK_YARD_LINE);
      } else {
        const returnYardLine = Math.max(20, situation.yardLine);
        changePossession(100 - returnYardLine);
      }

      advanceClock();
      if (!checkQuarterEnd()) break;
      continue;
    }

    if (shouldPunt(situation, situation.yardLine)) {
      const punter = findPunter(availableOffense);
      const puntEvent = resolvePunt(state, punter);
      events.push(puntEvent);
      currentDrive.plays++;
      playIndex++;

      const puntDistance = rng.int(30, 55);
      const receivingYardLine = Math.max(
        1,
        Math.min(99, (100 - situation.yardLine) - puntDistance),
      );
      const touchback = receivingYardLine <= 0;
      changePossession(touchback ? TOUCHBACK_YARD_LINE : receivingYardLine);

      advanceClock();
      if (!checkQuarterEnd()) break;
      continue;
    }

    const event = resolvePlay(state, availableOffense, availableDefense, rng);
    events.push(event);
    currentDrive.plays++;
    currentDrive.yards += event.yardage;
    playIndex++;

    processInjuries(event);

    if (event.outcome === "touchdown") {
      handleScoring(offenseTeam.teamId, 7);
      changePossession(TOUCHBACK_YARD_LINE);
      advanceClock();
      if (!checkQuarterEnd()) break;
      continue;
    }

    if (event.tags.includes("turnover")) {
      const turnoverYardLine = Math.max(
        1,
        Math.min(99, 100 - (situation.yardLine + event.yardage)),
      );
      changePossession(turnoverYardLine);
      advanceClock();
      if (!checkQuarterEnd()) break;
      continue;
    }

    const newYardLine = situation.yardLine + event.yardage;

    if (newYardLine <= 0) {
      handleScoring(
        possessionTeamId === input.home.teamId
          ? input.away.teamId
          : input.home.teamId,
        2,
      );
      changePossession(TOUCHBACK_YARD_LINE);
      advanceClock();
      if (!checkQuarterEnd()) break;
      continue;
    }

    if (event.tags.includes("first_down")) {
      situation = {
        down: 1,
        distance: Math.min(10, 100 - newYardLine),
        yardLine: Math.min(99, newYardLine),
      };
    } else if (situation.down >= 4) {
      const turnoverYardLine = Math.max(1, 100 - newYardLine);
      changePossession(turnoverYardLine);
    } else {
      situation = {
        down: (situation.down + 1) as 1 | 2 | 3 | 4,
        distance: situation.distance - event.yardage,
        yardLine: Math.max(1, Math.min(99, newYardLine)),
      };
    }

    advanceClock();
    if (!checkQuarterEnd()) break;
  }

  if (currentDrive.plays > 0) {
    driveSummaries.push({
      teamId: currentDrive.teamId,
      startYardLine: currentDrive.startYardLine,
      plays: currentDrive.plays,
      yards: currentDrive.yards,
    } as unknown as DriveSummary);
  }

  return {
    gameId: input.gameId,
    seed: input.seed,
    finalScore: { home: homeScore, away: awayScore },
    events,
    boxScore: {} as BoxScore,
    driveLog: driveSummaries,
    injuryReport,
  };
}
