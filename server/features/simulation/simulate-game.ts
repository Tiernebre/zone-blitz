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
import { resolvePunt } from "./resolve-punt.ts";
import { resolveFieldGoal } from "./resolve-field-goal.ts";
import { resolveFourthDown } from "./resolve-fourth-down.ts";
import { buildPlayEvent } from "./play-event.ts";
import {
  COVERAGE_UNIT_POSITIONS,
  findEligiblePlayer,
  findEligiblePlayers,
  KICKER_POSITIONS,
  RETURNER_POSITIONS,
} from "./find-eligible-player.ts";

import {
  formatClock,
  KICKOFF_STARTING_YARD_LINE,
  KNEEL_CLOCK_BURN,
  OT_SECONDS,
  QUARTER_SECONDS,
  SECONDS_PER_PLAY,
  shouldClockStop,
  shouldKneel,
  trySpendTimeout,
} from "./game-clock.ts";
import {
  advanceDowns,
  applyAcceptedPenalty,
  handleTurnover,
  startNewDrive,
  switchPossession,
} from "./possession.ts";
import {
  determineScoringOutcome,
  resolveConversion,
} from "./resolve-scoring.ts";
import type { ConversionContext } from "./resolve-scoring.ts";
import type { SimulationState } from "./game-state-manager.ts";
import {
  addScore,
  applyKneel,
  createInitialState,
  incrementGlobalPlayIndex,
  recordPlay,
  resetHalfTimeouts,
  setClock,
  setPossession,
  setQuarter,
  tickClock,
  useTimeout,
} from "./game-state-manager.ts";

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

export interface ActiveRosters {
  homeActive: PlayerRuntime[];
  awayActive: PlayerRuntime[];
  homeBench: PlayerRuntime[];
  awayBench: PlayerRuntime[];
  injuredPlayerIds: Set<string>;
}

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

function pickInjurySeverity(rng: SeededRng): InjurySeverity {
  const roll = rng.next();
  let cumulative = 0;
  for (let i = 0; i < INJURY_SEVERITIES.length; i++) {
    cumulative += INJURY_WEIGHTS[i];
    if (roll < cumulative) return INJURY_SEVERITIES[i];
  }
  return "shake_off";
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

  const state: SimulationState = createInitialState({
    kickoffYardLine: KICKOFF_STARTING_YARD_LINE,
  });

  function findPlayerByBucket(
    side: "home" | "away",
    bucket: PlayerRuntime["neutralBucket"],
  ): PlayerRuntime | undefined {
    const active = side === "home" ? rosters.homeActive : rosters.awayActive;
    return findEligiblePlayer(active, {
      positions: [bucket],
      injuredIds: rosters.injuredPlayerIds,
    });
  }

  function currentOffenseTeamId(): string {
    return state.possession === "home" ? input.home.teamId : input.away.teamId;
  }

  function currentDefenseTeamId(): string {
    return state.possession === "home" ? input.away.teamId : input.home.teamId;
  }

  function findKicker(side: "home" | "away"): PlayerRuntime {
    const team = side === "home" ? input.home : input.away;
    const active = side === "home" ? rosters.homeActive : rosters.awayActive;
    const fallback = team.starters.find((p) => p.neutralBucket === "K") ??
      team.starters[0];
    return findEligiblePlayer(active, {
      positions: KICKER_POSITIONS,
      injuredIds: rosters.injuredPlayerIds,
      fallback,
    })!;
  }

  function findReturner(side: "home" | "away"): PlayerRuntime | undefined {
    const active = side === "home" ? rosters.homeActive : rosters.awayActive;
    return findEligiblePlayer(active, {
      positions: RETURNER_POSITIONS,
      injuredIds: rosters.injuredPlayerIds,
    });
  }

  function findCoverageUnit(side: "home" | "away"): PlayerRuntime[] {
    const active = side === "home" ? rosters.homeActive : rosters.awayActive;
    return findEligiblePlayers(active, {
      positions: COVERAGE_UNIT_POSITIONS,
      injuredIds: rosters.injuredPlayerIds,
      limit: 4,
    });
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
    incrementGlobalPlayIndex(state);

    if (result.isReturnTouchdown) {
      addScore(state, receivingSide, 6);

      doConversion(receivingTeamId);

      setPossession(state, kickingSide);
      performKickoff(receivingSide);
      return;
    }

    if (result.isOnsideRecovery) {
      setPossession(state, kickingSide);
      startNewDrive(state, result.startingYardLine);
      return;
    }

    setPossession(state, receivingSide);
    startNewDrive(state, result.startingYardLine);
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

  function doConversion(scoringTeamId: string): void {
    const ctx: ConversionContext = {
      gameId,
      state,
      scoringTeamId,
      homeTeamId: input.home.teamId,
      home: input.home,
      away: input.away,
      rosters,
      buildTeamRuntime,
      buildGameState,
      findKicker,
    };
    const conversionEvents = resolveConversion(ctx, rng);
    events.push(...conversionEvents);
  }

  function handleScoring(event: PlayEvent): boolean {
    const result = determineScoringOutcome(event, input.home.teamId);
    if (!result.scored) return false;

    addScore(state, result.scoringTeamSide!, result.points!);

    if (result.type === "safety") {
      performKickoff(result.kickoffSide!, { isSafetyKick: result.safetyKick });
      return true;
    }

    // TD or return TD
    doConversion(result.scoringTeamId!);
    performKickoff(result.kickoffSide!);
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
    recordPlay(state);

    if (fgResult.outcome === "made") {
      const kickingSide: "home" | "away" =
        currentOffenseTeamId() === input.home.teamId ? "home" : "away";
      addScore(state, kickingSide, 3);
      performKickoff(kickingSide);
    } else {
      switchPossession(state);
      startNewDrive(state, fgResult.defenseYardLine);
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
    recordPlay(state);

    if (puntResult.outcome === "blocked_punt") {
      switchPossession(state);
      startNewDrive(state, 100 - state.yardLine);
    } else if (puntResult.outcome === "muffed_punt") {
      switchPossession(state);
      startNewDrive(state, 100 - puntResult.landingYardLine);
    } else {
      switchPossession(state);
      startNewDrive(state, 100 - puntResult.landingYardLine);
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
    recordPlay(state);
    tickClock(state, KNEEL_CLOCK_BURN);
    applyKneel(state);
  }

  function runPlay(): boolean {
    if (shouldKneel(state)) {
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
      const timeoutSide = trySpendTimeout(state, rng);
      if (timeoutSide) {
        useTimeout(state, timeoutSide);
        event.tags.push("timeout");
      }
    }

    processInjury(event);
    events.push(event);

    recordPlay(state);

    if (!shouldClockStop(event)) {
      tickClock(state, SECONDS_PER_PLAY);
    } else {
      tickClock(state, rng.int(5, 15));
    }

    if (event.penalty?.accepted && !event.tags.includes("return_td")) {
      applyAcceptedPenalty(state, event, currentOffenseTeamId());
      return false;
    }

    if (handleScoring(event)) return true;
    if (handleTurnover(state, event)) return true;

    advanceDowns(state, event.yardage);

    // Turnover on downs: 4th-down go-for-it failed to convert
    // Cast needed: advanceDowns mutates down through the state-manager,
    // but TypeScript narrows state.down to 4 inside the isFourthDownAttempt guard.
    if (isFourthDownAttempt && (state.down as number) !== 1) {
      const turnoverYardLine = Math.max(
        1,
        Math.min(99, state.yardLine),
      );
      switchPossession(state);
      startNewDrive(state, 100 - turnoverYardLine);
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
    setQuarter(state, q, QUARTER_SECONDS);

    if (q === 3) {
      resetHalfTimeouts(state);
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
    setQuarter(state, "OT", OT_SECONDS);

    const otCoinFlip: "home" | "away" = rng.next() < 0.5 ? "home" : "away";
    setPossession(state, otCoinFlip);
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
          setClock(state, OT_SECONDS);
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
