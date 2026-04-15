import type {
  NeutralBucket,
  PlayerAttributeKey,
  PlayerAttributes,
  SchemeFingerprint,
} from "@zone-blitz/shared";
import { computeSchemeScore, type PlayerForFit } from "../schemes/fit.ts";
import type {
  DefensiveCall,
  OffensiveCall,
  PlayEvent,
  PlayOutcome,
  PlayParticipant,
  PlayTag,
} from "./events.ts";
import type { SeededRng } from "./rng.ts";

// ─── Types ───

export type Situation = {
  down: 1 | 2 | 3 | 4;
  distance: number;
  yardLine: number;
};

export type GameState = {
  gameId: string;
  quarter: 1 | 2 | 3 | 4 | "OT";
  clock: string;
  driveIndex: number;
  playIndex: number;
  situation: Situation;
  offenseTeamId: string;
  defenseTeamId: string;
};

export type OnFieldPlayer = {
  playerId: string;
  neutralBucket: NeutralBucket;
  attributes: PlayerAttributes;
};

export type CoachingMods = Record<string, never>;

export type TeamRuntime = {
  fingerprint: SchemeFingerprint;
  onField: OnFieldPlayer[];
  coachingMods: CoachingMods;
};

export type MatchupType =
  | "pass_pro_vs_pass_rush"
  | "route_vs_coverage"
  | "block_vs_shed"
  | "ball_carrier_vs_tackle";

export type Matchup = {
  type: MatchupType;
  attacker: OnFieldPlayer;
  defender: OnFieldPlayer;
};

export type MatchupContribution = {
  matchup: Matchup;
  score: number;
  tags: PlayTag[];
};

export type RollMatchupInput = {
  matchup: Matchup;
  offenseFingerprint: SchemeFingerprint;
  defenseFingerprint: SchemeFingerprint;
  coachingMods: { offense: CoachingMods; defense: CoachingMods };
  situation: Situation;
  rng: SeededRng;
};

// ─── Constants ───

const RUN_CONCEPTS = [
  "inside_run",
  "outside_run",
  "power_run",
  "counter_run",
  "draw",
] as const;

const PASS_CONCEPTS = [
  "short_pass",
  "medium_pass",
  "deep_pass",
  "screen",
  "play_action",
] as const;

const FORMATIONS = ["shotgun", "under_center", "pistol"] as const;

const FRONTS = ["3-4", "4-3", "nickel", "dime"] as const;

const MATCHUP_ATTRIBUTES: Record<
  MatchupType,
  {
    attack: readonly PlayerAttributeKey[];
    defend: readonly PlayerAttributeKey[];
  }
> = {
  pass_pro_vs_pass_rush: {
    attack: ["passBlocking", "strength", "agility"],
    defend: ["passRushing", "acceleration", "strength"],
  },
  route_vs_coverage: {
    attack: ["routeRunning", "catching", "speed"],
    defend: ["manCoverage", "zoneCoverage", "anticipation"],
  },
  block_vs_shed: {
    attack: ["runBlocking", "strength"],
    defend: ["blockShedding", "runDefense", "strength"],
  },
  ball_carrier_vs_tackle: {
    attack: ["elusiveness", "speed", "ballCarrying", "acceleration"],
    defend: ["tackling", "speed", "anticipation"],
  },
};

const OFFENSIVE_LINEMEN: ReadonlySet<NeutralBucket> = new Set([
  "OT",
  "IOL",
]);
const PASS_RUSHERS: ReadonlySet<NeutralBucket> = new Set(["EDGE", "IDL"]);
const RECEIVERS: ReadonlySet<NeutralBucket> = new Set(["WR", "TE"]);
const COVERAGE_DEFENDERS: ReadonlySet<NeutralBucket> = new Set([
  "CB",
  "S",
  "LB",
]);
const RUN_BLOCKERS: ReadonlySet<NeutralBucket> = new Set(["OT", "IOL", "TE"]);
const RUN_DEFENDERS: ReadonlySet<NeutralBucket> = new Set([
  "IDL",
  "EDGE",
  "LB",
]);
const BALL_CARRIERS: ReadonlySet<NeutralBucket> = new Set(["RB"]);
const TACKLERS: ReadonlySet<NeutralBucket> = new Set(["LB", "S", "CB"]);

// ─── drawOffensiveCall ───

export function drawOffensiveCall(
  fingerprint: SchemeFingerprint,
  situation: Situation,
  rng: SeededRng,
): OffensiveCall {
  const offense = fingerprint.offense;
  const runPassLean = offense?.runPassLean ?? 50;
  const personnelWeight = offense?.personnelWeight ?? 50;
  const formationLean = offense?.formationUnderCenterShotgun ?? 50;
  const motionRate = offense?.preSnapMotionRate ?? 50;
  const passingDepth = offense?.passingDepth ?? 50;
  const runBlocking = offense?.runGameBlocking ?? 50;

  let passProbability = 0.3 + (runPassLean / 100) * 0.4;

  if (situation.down === 3 && situation.distance >= 7) {
    passProbability += 0.25;
  } else if (situation.down === 3 && situation.distance >= 4) {
    passProbability += 0.15;
  }
  if (situation.yardLine <= 3) {
    passProbability -= 0.2;
  }
  passProbability = Math.max(0.1, Math.min(0.9, passProbability));

  const isPass = rng.next() < passProbability;

  let concept: string;
  if (isPass) {
    if (passingDepth < 35) {
      concept = rng.pick(["short_pass", "screen"]);
    } else if (passingDepth > 65) {
      concept = rng.pick(["deep_pass", "play_action"]);
    } else {
      concept = rng.pick([...PASS_CONCEPTS]);
    }
  } else {
    if (runBlocking < 40) {
      concept = rng.pick(["inside_run", "outside_run"]);
    } else if (runBlocking > 60) {
      concept = rng.pick(["power_run", "counter_run"]);
    } else {
      concept = rng.pick([...RUN_CONCEPTS]);
    }
  }

  let personnel: string;
  if (personnelWeight < 30) {
    personnel = "11";
  } else if (personnelWeight < 60) {
    personnel = rng.pick(["11", "12"]);
  } else if (personnelWeight < 80) {
    personnel = rng.pick(["12", "21"]);
  } else {
    personnel = rng.pick(["21", "22"]);
  }

  let formation: string;
  if (formationLean < 30) {
    formation = "under_center";
  } else if (formationLean > 70) {
    formation = "shotgun";
  } else {
    formation = rng.pick([...FORMATIONS]);
  }

  const motion = rng.next() < motionRate / 100
    ? rng.pick(["jet", "orbit", "shift"])
    : "none";

  return { concept, personnel, formation, motion };
}

// ─── drawDefensiveCall ───

export function drawDefensiveCall(
  fingerprint: SchemeFingerprint,
  situation: Situation,
  rng: SeededRng,
): DefensiveCall {
  const defense = fingerprint.defense;
  const frontOddEven = defense?.frontOddEven ?? 50;
  const subPackageLean = defense?.subPackageLean ?? 50;
  const coverageManZone = defense?.coverageManZone ?? 50;
  const coverageShell = defense?.coverageShell ?? 50;
  const pressureRate = defense?.pressureRate ?? 50;

  let front: string;
  if (subPackageLean > 70) {
    front = rng.pick(["nickel", "dime"]);
  } else if (frontOddEven < 40) {
    front = "3-4";
  } else if (frontOddEven > 60) {
    front = "4-3";
  } else {
    front = rng.pick([...FRONTS]);
  }

  let coverage: string;
  const isMan = rng.next() < (1 - coverageManZone / 100);
  if (isMan) {
    coverage = coverageShell < 50 ? "cover_1" : "cover_0";
  } else {
    if (coverageShell < 40) {
      coverage = "cover_3";
    } else if (coverageShell > 60) {
      coverage = rng.pick(["cover_2", "cover_4"]);
    } else {
      coverage = rng.pick(["cover_2", "cover_3", "cover_4", "cover_6"]);
    }
  }

  let blitzProbability = 0.1 + (pressureRate / 100) * 0.5;
  if (situation.down === 3 && situation.distance >= 5) {
    blitzProbability += 0.1;
  }
  blitzProbability = Math.max(0.05, Math.min(0.8, blitzProbability));

  let pressure: string;
  const roll = rng.next();
  if (roll < blitzProbability * 0.3) {
    pressure = "zero_blitz";
  } else if (roll < blitzProbability) {
    pressure = "blitz";
  } else {
    pressure = "base";
  }

  return { front, coverage, pressure };
}

// ─── identifyMatchups ───

function filterByBucket(
  players: OnFieldPlayer[],
  buckets: ReadonlySet<NeutralBucket>,
): OnFieldPlayer[] {
  return players.filter((p) => buckets.has(p.neutralBucket));
}

function zipPair(
  attackers: OnFieldPlayer[],
  defenders: OnFieldPlayer[],
  type: MatchupType,
): Matchup[] {
  const count = Math.min(attackers.length, defenders.length);
  const result: Matchup[] = [];
  for (let i = 0; i < count; i++) {
    result.push({ type, attacker: attackers[i], defender: defenders[i] });
  }
  return result;
}

export function identifyMatchups(
  call: OffensiveCall,
  _coverage: DefensiveCall,
  offenseOnField: OnFieldPlayer[],
  defenseOnField: OnFieldPlayer[],
): Matchup[] {
  const isRun = call.concept.includes("run") || call.concept === "draw";

  if (isRun) {
    const blockers = filterByBucket(offenseOnField, RUN_BLOCKERS);
    const defenders = filterByBucket(defenseOnField, RUN_DEFENDERS);
    const carriers = filterByBucket(offenseOnField, BALL_CARRIERS);
    const tacklers = filterByBucket(defenseOnField, TACKLERS);

    return [
      ...zipPair(blockers, defenders, "block_vs_shed"),
      ...zipPair(carriers, tacklers, "ball_carrier_vs_tackle"),
    ];
  }

  const protectors = filterByBucket(offenseOnField, OFFENSIVE_LINEMEN);
  const rushers = filterByBucket(defenseOnField, PASS_RUSHERS);
  const receivers = filterByBucket(offenseOnField, RECEIVERS);
  const coverageDefenders = filterByBucket(defenseOnField, COVERAGE_DEFENDERS);

  return [
    ...zipPair(protectors, rushers, "pass_pro_vs_pass_rush"),
    ...zipPair(receivers, coverageDefenders, "route_vs_coverage"),
  ];
}

// ─── rollMatchup ───

function attrAverage(
  player: OnFieldPlayer,
  keys: readonly PlayerAttributeKey[],
): number {
  let sum = 0;
  for (const key of keys) {
    sum += player.attributes[key] ?? 0;
  }
  return sum / keys.length;
}

function schemeFitModifier(
  player: OnFieldPlayer,
  fingerprint: SchemeFingerprint,
): number {
  const forFit: PlayerForFit = {
    neutralBucket: player.neutralBucket,
    attributes: player.attributes,
  };
  const score = computeSchemeScore(forFit, fingerprint);
  return (score - 50) / 5;
}

function situationModifier(situation: Situation): number {
  let mod = 0;
  if (situation.down === 3 && situation.distance >= 7) mod -= 2;
  if (situation.yardLine <= 5) mod += 2;
  return mod;
}

export function rollMatchup(input: RollMatchupInput): MatchupContribution {
  const { matchup, offenseFingerprint, defenseFingerprint, situation, rng } =
    input;
  const attrs = MATCHUP_ATTRIBUTES[matchup.type];

  const attackScore = attrAverage(matchup.attacker, attrs.attack);
  const defendScore = attrAverage(matchup.defender, attrs.defend);

  const attackFit = schemeFitModifier(matchup.attacker, offenseFingerprint);
  const defendFit = schemeFitModifier(matchup.defender, defenseFingerprint);

  const sitMod = situationModifier(situation);
  const noise = rng.gaussian(0, 8, -20, 20);

  const score = (attackScore - defendScore) + (attackFit - defendFit) + sitMod +
    noise;

  const tags: PlayTag[] = [];
  if (
    matchup.type === "pass_pro_vs_pass_rush" && score < -15
  ) {
    tags.push("pressure");
  }

  return { matchup, score, tags };
}

// ─── synthesizeOutcome ───

export function synthesizeOutcome(
  call: OffensiveCall,
  coverage: DefensiveCall,
  contributions: MatchupContribution[],
  state: GameState,
  rng: SeededRng,
): PlayEvent {
  const isRun = call.concept.includes("run") || call.concept === "draw";
  const participants = buildParticipants(contributions);

  let outcome: PlayOutcome;
  let yardage: number;
  const tags: PlayTag[] = [];

  for (const c of contributions) {
    tags.push(...c.tags);
  }

  if (isRun) {
    ({ outcome, yardage } = resolveRun(contributions, rng));
  } else {
    ({ outcome, yardage } = resolvePass(contributions, call, rng));
  }

  const fumbleRoll = rng.next();
  if (fumbleRoll < 0.02 && outcome !== "sack" && outcome !== "interception") {
    outcome = "fumble";
    tags.push("fumble", "turnover");
  }

  if (rng.next() < 0.03) {
    tags.push("penalty");
  }

  if (rng.next() < 0.005) {
    tags.push("injury");
  }

  if (yardage >= state.situation.distance) {
    tags.push("first_down");
  }
  if (yardage >= 20) {
    tags.push("big_play");
  }
  if (state.situation.yardLine + yardage >= 100) {
    outcome = "touchdown";
    yardage = 100 - state.situation.yardLine;
    tags.push("touchdown");
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
  };
}

function resolvePass(
  contributions: MatchupContribution[],
  call: OffensiveCall,
  rng: SeededRng,
): { outcome: PlayOutcome; yardage: number } {
  const proContributions = contributions.filter(
    (c) => c.matchup.type === "pass_pro_vs_pass_rush",
  );
  const routeContributions = contributions.filter(
    (c) => c.matchup.type === "route_vs_coverage",
  );

  const avgProScore = proContributions.length > 0
    ? proContributions.reduce((sum, c) => sum + c.score, 0) /
      proContributions.length
    : 0;

  if (avgProScore < -15 && rng.next() < 0.6) {
    return { outcome: "sack", yardage: -rng.int(3, 10) };
  }

  if (avgProScore < -5) {
    if (rng.next() < 0.3) {
      return { outcome: "sack", yardage: -rng.int(2, 8) };
    }
  }

  const bestRoute = routeContributions.length > 0
    ? routeContributions.reduce((best, c) => c.score > best.score ? c : best)
    : null;

  if (!bestRoute) {
    return { outcome: "pass_incomplete", yardage: 0 };
  }

  if (bestRoute.score < -20 && rng.next() < 0.15) {
    return { outcome: "interception", yardage: 0 };
  }

  const completionBase = 0.55 + bestRoute.score / 100;
  const completionChance = Math.max(0.15, Math.min(0.9, completionBase));

  if (rng.next() < completionChance) {
    const depthBase = call.concept.includes("deep")
      ? 25
      : call.concept.includes("medium") || call.concept === "play_action"
      ? 14
      : call.concept === "screen"
      ? 3
      : 7;

    const yardage = Math.max(
      -2,
      depthBase + rng.gaussian(0, 5, -10, 30) +
        Math.round(bestRoute.score / 10),
    );
    return { outcome: "pass_complete", yardage };
  }

  return { outcome: "pass_incomplete", yardage: 0 };
}

function resolveRun(
  contributions: MatchupContribution[],
  rng: SeededRng,
): { outcome: PlayOutcome; yardage: number } {
  const blockContributions = contributions.filter(
    (c) => c.matchup.type === "block_vs_shed",
  );
  const carrierContributions = contributions.filter(
    (c) => c.matchup.type === "ball_carrier_vs_tackle",
  );

  const avgBlock = blockContributions.length > 0
    ? blockContributions.reduce((sum, c) => sum + c.score, 0) /
      blockContributions.length
    : 0;

  const avgCarrier = carrierContributions.length > 0
    ? carrierContributions.reduce((sum, c) => sum + c.score, 0) /
      carrierContributions.length
    : 0;

  const baseYardage = 3.5 + (avgBlock / 10) + (avgCarrier / 15);
  const yardage = Math.round(
    baseYardage + rng.gaussian(0, 3, -5, 15),
  );

  return { outcome: "rush", yardage: Math.max(-5, yardage) };
}

function buildParticipants(
  contributions: MatchupContribution[],
): PlayParticipant[] {
  const seen = new Set<string>();
  const participants: PlayParticipant[] = [];

  for (const c of contributions) {
    if (!seen.has(c.matchup.attacker.playerId)) {
      seen.add(c.matchup.attacker.playerId);
      participants.push({
        role: c.matchup.type.split("_vs_")[0],
        playerId: c.matchup.attacker.playerId,
        tags: c.tags.filter((t) => t === "pressure"),
      });
    }
    if (!seen.has(c.matchup.defender.playerId)) {
      seen.add(c.matchup.defender.playerId);
      participants.push({
        role: c.matchup.type.split("_vs_")[1],
        playerId: c.matchup.defender.playerId,
        tags: [],
      });
    }
  }

  return participants;
}

// ─── resolvePlay ───

export function resolvePlay(
  state: GameState,
  offense: TeamRuntime,
  defense: TeamRuntime,
  rng: SeededRng,
): PlayEvent {
  const call = drawOffensiveCall(offense.fingerprint, state.situation, rng);
  const coverage = drawDefensiveCall(defense.fingerprint, state.situation, rng);
  const matchups = identifyMatchups(
    call,
    coverage,
    offense.onField,
    defense.onField,
  );

  const contributions = matchups.map((matchup) =>
    rollMatchup({
      matchup,
      offenseFingerprint: offense.fingerprint,
      defenseFingerprint: defense.fingerprint,
      coachingMods: {
        offense: offense.coachingMods,
        defense: defense.coachingMods,
      },
      situation: state.situation,
      rng,
    })
  );

  return synthesizeOutcome(call, coverage, contributions, state, rng);
}
