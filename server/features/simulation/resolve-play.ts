import type {
  NeutralBucket,
  PlayerAttributes,
  SchemeFingerprint,
  SchemeFitLabel,
} from "@zone-blitz/shared";
import type {
  DefensiveCall,
  OffensiveCall,
  PenaltyInfo,
  PlayEvent,
} from "./events.ts";
import type { SeededRng } from "./rng.ts";
import { computeSchemeFit } from "../schemes/fit.ts";
import type { PlayerForFit } from "../schemes/fit.ts";
import {
  type PenaltyContext,
  pickPenalty,
  shouldPenaltyOccur,
} from "./resolve-penalty.ts";
import { resolveMatchups } from "./resolve-matchups.ts";
import { synthesizeRunOutcome } from "./synthesize-run-outcome.ts";
import { synthesizePassOutcome } from "./synthesize-pass-outcome.ts";

export interface Situation {
  down: 1 | 2 | 3 | 4;
  distance: number;
  yardLine: number;
}

export interface GameState {
  gameId: string;
  driveIndex: number;
  playIndex: number;
  quarter: 1 | 2 | 3 | 4 | "OT";
  clock: string;
  situation: Situation;
  offenseTeamId: string;
  defenseTeamId: string;
}

export interface PlayerRuntime {
  playerId: string;
  neutralBucket: NeutralBucket;
  attributes: PlayerAttributes;
}

export interface TeamRuntime {
  fingerprint: SchemeFingerprint;
  onField: PlayerRuntime[];
  coachingMods: CoachingMods;
}

export interface CoachingMods {
  schemeFitBonus: number;
  situationalBonus: number;
  aggressiveness: number;
  /**
   * Penalty-rate multiplier. 1.0 = league-average (baseline PER_PLAY_PENALTY_RATE).
   * Values below 1 indicate a disciplined team (fewer flags); above 1, sloppier.
   * Driven by HC `leadership`.
   */
  penaltyDiscipline: number;
}

export type MatchupType =
  | "pass_protection"
  | "pass_rush"
  | "route_coverage"
  | "run_block"
  | "run_defense";

export interface Matchup {
  type: MatchupType;
  attacker: PlayerRuntime;
  defender: PlayerRuntime;
}

export interface MatchupContribution {
  matchup: Matchup;
  attackerFit: SchemeFitLabel;
  defenderFit: SchemeFitLabel;
  score: number;
}

const FORMATIONS = [
  "shotgun",
  "under_center",
  "pistol",
  "singleback",
  "i_form",
] as const;

const DEFENSIVE_FRONTS = ["3-4", "4-3", "nickel", "dime"] as const;
const COVERAGES = [
  "cover_0",
  "cover_1",
  "cover_2",
  "cover_3",
  "cover_4",
  "cover_6",
] as const;

const RUN_CONCEPTS = new Set([
  "inside_zone",
  "outside_zone",
  "power",
  "counter",
  "draw",
]);
const PASS_CONCEPTS = new Set([
  "screen",
  "quick_pass",
  "play_action",
  "dropback",
  "deep_shot",
]);

// ── Play-call tuning knobs ────────────────────────────────────────────
const PLAY_CALL = {
  runBias: 0.07,
  shortYardageRunBoost: 0.15,
  longYardageRunPenalty: 0.08,
  twoMinuteRunPenalty: 0.2,
  runProbFloor: 0.15,
  runProbCeiling: 0.85,
  rpoIntegrationThreshold: 60,
  passingDepthThreshold: 50,
  personnelWeightThreshold: 60,
  formationShotgunThreshold: 60,
  formationUnderCenterThreshold: 40,
  blitzPassSituationBoost: 0.15,
  blitzTwoMinutePenalty: 0.2,
  blitzFloor: 0.05,
  blitzCeiling: 0.8,
} as const;

// ── Pass-resolution calibration knobs ─────────────────────────────────
export const PASS_RESOLUTION = {
  completion: {
    base: 0.655,
    coverageModifier: 0.010,
    floor: 0.18,
    ceiling: 0.92,
  },
  interception: { base: 0.022, coverageModifier: 0.002, floor: 0.004 },
  sack: { base: 0.086, protectionModifier: 0.005, floor: 0.01 },
  bigPlay: {
    base: 0.20,
    coverageModifier: 0.008,
    floor: 0.05,
    ceiling: 0.45,
    yards: { min: 13, max: 35 },
  },
  completionYards: { min: 3, max: 14 },
  fumbleOnSack: 0.08,
} as const;

// ── Run-resolution calibration knobs ──────────────────────────────────
export const RUN_RESOLUTION = {
  stuffThreshold: -20,
  stuffYards: { min: -3, max: 0 },
  shortGainThreshold: -5,
  shortGainYards: { min: 1, max: 5 },
  bigPlayThreshold: 15,
  bigPlayYards: { min: 9, max: 26 },
  normalYards: { min: 2, max: 8 },
  fumbleRate: 0.009,
} as const;

// ── Miscellaneous play-outcome knobs ──────────────────────────────────
const INJURY_ON_PLAY = 0.005;
const RETURN_TD = {
  base: 0.02,
  attrScale: 0.06 / 60,
  attrBaseline: 30,
  floor: 0.01,
  ceiling: 0.10,
} as const;
export const SACK_YARDAGE = { min: -10, max: -3 } as const;

const FIT_MODIFIER: Record<SchemeFitLabel, number> = {
  ideal: 10,
  fits: 5,
  neutral: 0,
  poor: -5,
  miscast: -10,
};

const MATCHUP_ATTR_KEYS: Record<MatchupType, {
  attacker: readonly (keyof PlayerAttributes)[];
  defender: readonly (keyof PlayerAttributes)[];
}> = {
  pass_protection: {
    attacker: ["passBlocking", "strength", "agility"],
    defender: ["passRushing", "acceleration", "strength"],
  },
  pass_rush: {
    attacker: ["passRushing", "acceleration", "agility"],
    defender: ["passBlocking", "strength", "agility"],
  },
  route_coverage: {
    attacker: ["routeRunning", "speed", "catching"],
    defender: ["manCoverage", "zoneCoverage", "speed"],
  },
  run_block: {
    attacker: ["runBlocking", "strength", "acceleration"],
    defender: ["blockShedding", "strength", "runDefense"],
  },
  run_defense: {
    attacker: ["blockShedding", "tackling", "runDefense"],
    defender: ["runBlocking", "strength", "acceleration"],
  },
};

function parseClock(clock: string): number {
  const [mins, secs] = clock.split(":").map(Number);
  return mins * 60 + (secs ?? 0);
}

export function isTwoMinuteDrill(
  quarter: 1 | 2 | 3 | 4 | "OT",
  clock: string,
): boolean {
  if (quarter !== 2 && quarter !== 4) return false;
  return parseClock(clock) <= 120;
}

export function drawOffensiveCall(
  fingerprint: SchemeFingerprint,
  situation: Situation,
  rng: SeededRng,
  options?: { twoMinute?: boolean },
): OffensiveCall {
  const offense = fingerprint.offense;
  const runPassLean = offense?.runPassLean ?? 50;

  const isShortYardage = situation.down >= 3 && situation.distance <= 3;
  const isLongYardage = situation.distance >= 7;

  let runProbability = (100 - runPassLean) / 100 + PLAY_CALL.runBias;
  if (isShortYardage) runProbability += PLAY_CALL.shortYardageRunBoost;
  if (isLongYardage) runProbability -= PLAY_CALL.longYardageRunPenalty;
  if (options?.twoMinute) runProbability -= PLAY_CALL.twoMinuteRunPenalty;
  runProbability = Math.max(
    PLAY_CALL.runProbFloor,
    Math.min(PLAY_CALL.runProbCeiling, runProbability),
  );

  const isRun = rng.next() < runProbability;

  let concept: string;
  if (isRun) {
    const runConcepts = [...RUN_CONCEPTS];
    if ((offense?.rpoIntegration ?? 50) > PLAY_CALL.rpoIntegrationThreshold) {
      runConcepts.push("rpo");
    }
    concept = rng.pick(runConcepts);
  } else {
    const passConcepts = [...PASS_CONCEPTS];
    if (
      isLongYardage &&
      (offense?.passingDepth ?? 50) > PLAY_CALL.passingDepthThreshold
    ) {
      passConcepts.push("deep_shot");
    }
    concept = rng.pick(passConcepts);
  }

  const personnelWeight = offense?.personnelWeight ?? 50;
  const heavyPersonnel = personnelWeight > PLAY_CALL.personnelWeightThreshold;
  const personnel = heavyPersonnel
    ? rng.pick(["12", "21", "22"] as const)
    : rng.pick(["11", "10"] as const);

  const formationLean = offense?.formationUnderCenterShotgun ?? 50;
  const formation = formationLean > PLAY_CALL.formationShotgunThreshold
    ? rng.pick(["shotgun", "pistol"] as const)
    : formationLean < PLAY_CALL.formationUnderCenterThreshold
    ? rng.pick(["under_center", "singleback", "i_form"] as const)
    : rng.pick(FORMATIONS);

  const motionRate = offense?.preSnapMotionRate ?? 50;
  const motion = rng.next() * 100 < motionRate
    ? rng.pick(["jet", "orbit", "shift"] as const)
    : "none";

  return { concept, personnel, formation, motion };
}

export function drawDefensiveCall(
  fingerprint: SchemeFingerprint,
  situation: Situation,
  rng: SeededRng,
  options?: { twoMinute?: boolean },
): DefensiveCall {
  const defense = fingerprint.defense;

  const frontLean = defense?.frontOddEven ?? 50;
  const subPackage = defense?.subPackageLean ?? 50;
  let front: string;
  if (options?.twoMinute) {
    front = rng.pick(["nickel", "dime"] as const);
  } else if (subPackage > 65) {
    front = rng.pick(["nickel", "dime"] as const);
  } else if (frontLean < 40) {
    front = "3-4";
  } else if (frontLean > 60) {
    front = "4-3";
  } else {
    front = rng.pick(DEFENSIVE_FRONTS);
  }

  const manZone = defense?.coverageManZone ?? 50;
  const shell = defense?.coverageShell ?? 50;
  let coverage: string;
  if (options?.twoMinute) {
    coverage = rng.pick(["cover_2", "cover_3", "cover_4", "cover_6"] as const);
  } else if (manZone < 35) {
    coverage = shell < 50
      ? rng.pick(["cover_0", "cover_1"] as const)
      : "cover_1";
  } else if (manZone > 65) {
    coverage = shell > 60
      ? rng.pick(["cover_2", "cover_4", "cover_6"] as const)
      : "cover_3";
  } else {
    coverage = rng.pick(COVERAGES);
  }

  const pressureRate = defense?.pressureRate ?? 50;
  const isPassSituation = situation.down >= 3 && situation.distance >= 5;
  let blitzProb = pressureRate / 100;
  if (isPassSituation) blitzProb += PLAY_CALL.blitzPassSituationBoost;
  if (options?.twoMinute) blitzProb -= PLAY_CALL.blitzTwoMinutePenalty;
  blitzProb = Math.max(
    PLAY_CALL.blitzFloor,
    Math.min(PLAY_CALL.blitzCeiling, blitzProb),
  );

  let pressure: string;
  if (rng.next() < blitzProb) {
    pressure = manZone < 50
      ? rng.pick(["man_blitz", "all_out"] as const)
      : rng.pick(["zone_blitz", "man_blitz"] as const);
  } else {
    pressure = "four_man";
  }

  return { front, coverage, pressure };
}

const OFFENSIVE_POSITIONS = new Set<NeutralBucket>([
  "QB",
  "RB",
  "WR",
  "TE",
  "OT",
  "IOL",
]);
const DEFENSIVE_POSITIONS = new Set<NeutralBucket>([
  "EDGE",
  "IDL",
  "LB",
  "CB",
  "S",
]);

export function rollMatchup(
  input: {
    attacker: PlayerRuntime;
    defender: PlayerRuntime;
    schemeFitAttacker: SchemeFitLabel;
    schemeFitDefender: SchemeFitLabel;
    coaching: { offense: CoachingMods; defense: CoachingMods };
    situation: Situation;
    matchupType: MatchupType;
    rng: SeededRng;
  },
): MatchupContribution {
  const keys = MATCHUP_ATTR_KEYS[input.matchupType];

  let attackerScore = 0;
  for (const attr of keys.attacker) {
    attackerScore += input.attacker.attributes[attr] ?? 0;
  }
  attackerScore /= keys.attacker.length;

  let defenderScore = 0;
  for (const attr of keys.defender) {
    defenderScore += input.defender.attributes[attr] ?? 0;
  }
  defenderScore /= keys.defender.length;

  const fitModAttacker = FIT_MODIFIER[input.schemeFitAttacker];
  const fitModDefender = FIT_MODIFIER[input.schemeFitDefender];

  const coachingModAttacker = input.coaching.offense.schemeFitBonus +
    input.coaching.offense.situationalBonus;
  const coachingModDefender = input.coaching.defense.schemeFitBonus +
    input.coaching.defense.situationalBonus;

  let situationMod = 0;
  if (input.situation.down === 3 && input.situation.distance >= 8) {
    if (
      input.matchupType === "pass_rush" ||
      input.matchupType === "pass_protection"
    ) {
      situationMod = 3;
    }
  }
  if (input.situation.yardLine <= 10) {
    situationMod += 2;
  }

  const perturbation = input.rng.gaussian(0, 5, -15, 15);

  const rawScore = (attackerScore + fitModAttacker + coachingModAttacker) -
    (defenderScore + fitModDefender + coachingModDefender) +
    situationMod + perturbation;

  const score = Math.max(-50, Math.min(50, rawScore));

  return {
    matchup: {
      type: input.matchupType,
      attacker: input.attacker,
      defender: input.defender,
    },
    attackerFit: input.schemeFitAttacker,
    defenderFit: input.schemeFitDefender,
    score,
  };
}

export function synthesizeOutcome(
  call: OffensiveCall,
  coverage: DefensiveCall,
  contributions: MatchupContribution[],
  state: GameState,
  rng: SeededRng,
  offensePlayerIds?: string[],
  defensePlayerIds?: string[],
  penaltyDisciplineMultiplier = 1,
): PlayEvent {
  const isRunPlay = RUN_CONCEPTS.has(call.concept);

  const result = isRunPlay
    ? synthesizeRunOutcome(contributions, state.situation, rng)
    : synthesizePassOutcome(contributions, state.situation, rng);

  let { outcome } = result;
  let { yardage } = result;
  const { tags, participants } = result;

  if (rng.next() < INJURY_ON_PLAY) {
    tags.push("injury");
  }

  // Safety: offense driven behind their own goal line
  const resultYardLine = state.situation.yardLine + yardage;
  if (resultYardLine <= 0 && !tags.includes("turnover")) {
    outcome = "safety";
    yardage = -state.situation.yardLine;
    tags.push("safety");
  }

  const yardsToEndzone = 100 - state.situation.yardLine;
  if (yardage >= yardsToEndzone && !tags.includes("turnover")) {
    outcome = "touchdown";
    yardage = yardsToEndzone;
    tags.push("touchdown");
  }

  // Defensive return TD on turnovers
  if (tags.includes("turnover") && outcome !== "safety") {
    const turnoverDefender = contributions.find((c) => {
      if (outcome === "interception") {
        return c.matchup.type === "route_coverage" && c.score < -10;
      }
      return c.matchup.type === "pass_rush" ||
        c.matchup.type === "run_defense" ||
        c.matchup.type === "run_block";
    });
    const defender = turnoverDefender?.matchup.defender;
    const speed = defender?.attributes.speed ?? 50;
    const acceleration = defender?.attributes.acceleration ?? 50;
    const avgAttr = (speed + acceleration) / 2;
    const returnTdProb = RETURN_TD.base +
      (avgAttr - RETURN_TD.attrBaseline) * RETURN_TD.attrScale;
    if (
      rng.next() <
        Math.max(RETURN_TD.floor, Math.min(RETURN_TD.ceiling, returnTdProb))
    ) {
      tags.push("return_td", "touchdown");
      if (defender) {
        const existingIdx = participants.findIndex(
          (p) => p.playerId === defender.playerId,
        );
        if (existingIdx >= 0) {
          participants[existingIdx].tags.push("return_td", "touchdown");
        } else {
          participants.push({
            role: outcome === "interception" ? "route_coverage" : "run_defense",
            playerId: defender.playerId,
            tags: ["return_td", "touchdown"],
          });
        }
      }
    }
  }

  let penalty: PenaltyInfo | undefined;
  if (shouldPenaltyOccur(rng, penaltyDisciplineMultiplier)) {
    const offPositions = contributions
      .filter((c) => OFFENSIVE_POSITIONS.has(c.matchup.attacker.neutralBucket))
      .map((c) => c.matchup.attacker.neutralBucket);
    const defPositions = contributions
      .filter((c) => DEFENSIVE_POSITIONS.has(c.matchup.defender.neutralBucket))
      .map((c) => c.matchup.defender.neutralBucket);
    const offIds = offensePlayerIds ??
      contributions
        .filter((c) =>
          OFFENSIVE_POSITIONS.has(c.matchup.attacker.neutralBucket)
        )
        .map((c) => c.matchup.attacker.playerId);
    const defIds = defensePlayerIds ??
      contributions
        .filter((c) =>
          DEFENSIVE_POSITIONS.has(c.matchup.defender.neutralBucket)
        )
        .map((c) => c.matchup.defender.playerId);

    const ctx: PenaltyContext = {
      offenseTeamId: state.offenseTeamId,
      defenseTeamId: state.defenseTeamId,
      offensePositions: offPositions,
      defensePositions: defPositions,
      offensePlayerIds: offIds,
      defensePlayerIds: defIds,
      isRunPlay,
      playYardage: yardage,
      playGainedFirstDown: yardage >= state.situation.distance,
      situation: state.situation,
    };

    const penaltyResult = pickPenalty(ctx, rng);
    if (penaltyResult) {
      penalty = penaltyResult;
      tags.push("penalty");

      if (penalty.accepted) {
        tags.push("accepted_penalty");
        if (penalty.phase === "post_snap") {
          tags.push("negated_play");
        }
      } else {
        tags.push("declined_penalty");
      }
    }
  }

  return {
    gameId: state.gameId,
    driveIndex: state.driveIndex,
    playIndex: state.playIndex,
    quarter: state.quarter,
    clock: state.clock,
    situation: state.situation,
    offenseTeamId: state.offenseTeamId,
    defenseTeamId: state.defenseTeamId,
    call,
    coverage,
    participants,
    outcome,
    yardage,
    tags,
    penalty,
  };
}

export function resolvePlay(
  state: GameState,
  offense: TeamRuntime,
  defense: TeamRuntime,
  rng: SeededRng,
  options?: { twoMinute?: boolean },
): PlayEvent {
  const twoMinute = options?.twoMinute ?? false;
  const call = drawOffensiveCall(offense.fingerprint, state.situation, rng, {
    twoMinute,
  });
  const coverage = drawDefensiveCall(
    defense.fingerprint,
    state.situation,
    rng,
    { twoMinute },
  );
  const matchups = resolveMatchups(
    call,
    coverage,
    offense.onField,
    defense.onField,
    rng,
  );

  const contributions = matchups.map((m) => {
    const attackerForFit: PlayerForFit = {
      neutralBucket: m.attacker.neutralBucket,
      attributes: m.attacker.attributes,
    };
    const defenderForFit: PlayerForFit = {
      neutralBucket: m.defender.neutralBucket,
      attributes: m.defender.attributes,
    };

    return rollMatchup({
      attacker: m.attacker,
      defender: m.defender,
      schemeFitAttacker: computeSchemeFit(attackerForFit, offense.fingerprint),
      schemeFitDefender: computeSchemeFit(defenderForFit, defense.fingerprint),
      coaching: {
        offense: offense.coachingMods,
        defense: defense.coachingMods,
      },
      situation: state.situation,
      matchupType: m.type,
      rng,
    });
  });

  const penaltyDiscipline = (offense.coachingMods.penaltyDiscipline +
    defense.coachingMods.penaltyDiscipline) / 2;
  const event = synthesizeOutcome(
    call,
    coverage,
    contributions,
    state,
    rng,
    undefined,
    undefined,
    penaltyDiscipline,
  );
  if (twoMinute) {
    event.tags.push("two_minute");
  }
  return event;
}
