import type {
  NeutralBucket,
  PlayerAttributes,
  SchemeFingerprint,
  SchemeFitLabel,
} from "@zone-blitz/shared";
import type {
  DefensiveCall,
  OffensiveCall,
  PlayEvent,
  PlayOutcome,
  PlayTag,
} from "./events.ts";
import type { SeededRng } from "./rng.ts";
import { computeSchemeFit } from "../schemes/fit.ts";
import type { PlayerForFit } from "../schemes/fit.ts";

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

export function drawOffensiveCall(
  fingerprint: SchemeFingerprint,
  situation: Situation,
  rng: SeededRng,
): OffensiveCall {
  const offense = fingerprint.offense;
  const runPassLean = offense?.runPassLean ?? 50;

  const isShortYardage = situation.down >= 3 && situation.distance <= 3;
  const isLongYardage = situation.distance >= 7;

  let runProbability = (100 - runPassLean) / 100;
  if (isShortYardage) runProbability += 0.2;
  if (isLongYardage) runProbability -= 0.2;
  runProbability = Math.max(0.1, Math.min(0.9, runProbability));

  const isRun = rng.next() < runProbability;

  let concept: string;
  if (isRun) {
    const runConcepts = [...RUN_CONCEPTS];
    if ((offense?.rpoIntegration ?? 50) > 60) runConcepts.push("rpo");
    concept = rng.pick(runConcepts);
  } else {
    const passConcepts = [...PASS_CONCEPTS];
    if (isLongYardage && (offense?.passingDepth ?? 50) > 50) {
      passConcepts.push("deep_shot");
    }
    concept = rng.pick(passConcepts);
  }

  const personnelWeight = offense?.personnelWeight ?? 50;
  const heavyPersonnel = personnelWeight > 60;
  const personnel = heavyPersonnel
    ? rng.pick(["12", "21", "22"] as const)
    : rng.pick(["11", "10"] as const);

  const formationLean = offense?.formationUnderCenterShotgun ?? 50;
  const formation = formationLean > 60
    ? rng.pick(["shotgun", "pistol"] as const)
    : formationLean < 40
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
): DefensiveCall {
  const defense = fingerprint.defense;

  const frontLean = defense?.frontOddEven ?? 50;
  const subPackage = defense?.subPackageLean ?? 50;
  let front: string;
  if (subPackage > 65) {
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
  if (manZone < 35) {
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
  if (isPassSituation) blitzProb += 0.15;
  blitzProb = Math.max(0.05, Math.min(0.8, blitzProb));

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

export function identifyMatchups(
  call: OffensiveCall,
  coverage: DefensiveCall,
  offenseOnField: PlayerRuntime[],
  defenseOnField: PlayerRuntime[],
): Matchup[] {
  const matchups: Matchup[] = [];

  const offensivePlayers = offenseOnField.filter((p) =>
    OFFENSIVE_POSITIONS.has(p.neutralBucket)
  );
  const defensivePlayers = defenseOnField.filter((p) =>
    DEFENSIVE_POSITIONS.has(p.neutralBucket)
  );

  const isRunPlay = RUN_CONCEPTS.has(call.concept);
  const isBlitz = coverage.pressure !== "four_man";

  const oLinemen = offensivePlayers.filter((p) =>
    p.neutralBucket === "OT" || p.neutralBucket === "IOL"
  );
  const passRushers = defensivePlayers.filter((p) =>
    p.neutralBucket === "EDGE" || p.neutralBucket === "IDL"
  );
  const receivers = offensivePlayers.filter((p) =>
    p.neutralBucket === "WR" || p.neutralBucket === "TE"
  );
  const coveragePlayers = defensivePlayers.filter((p) =>
    p.neutralBucket === "CB" || p.neutralBucket === "S" ||
    p.neutralBucket === "LB"
  );
  const runBlockers = offensivePlayers.filter((p) =>
    p.neutralBucket === "OT" || p.neutralBucket === "IOL" ||
    p.neutralBucket === "TE" || p.neutralBucket === "RB"
  );
  const runDefenders = defensivePlayers.filter((p) =>
    p.neutralBucket === "IDL" || p.neutralBucket === "EDGE" ||
    p.neutralBucket === "LB"
  );

  if (isRunPlay) {
    const pairCount = Math.min(runBlockers.length, runDefenders.length);
    for (let i = 0; i < pairCount; i++) {
      matchups.push({
        type: "run_block",
        attacker: runBlockers[i],
        defender: runDefenders[i],
      });
    }
  } else {
    const protectionPairs = Math.min(oLinemen.length, passRushers.length);
    for (let i = 0; i < protectionPairs; i++) {
      matchups.push({
        type: "pass_protection",
        attacker: oLinemen[i],
        defender: passRushers[i],
      });
    }

    if (isBlitz) {
      const blitzers = coveragePlayers.filter((p) => p.neutralBucket === "LB");
      const extraBlockers = offensivePlayers.filter((p) =>
        p.neutralBucket === "RB"
      );
      const blitzPairs = Math.min(blitzers.length, extraBlockers.length);
      for (let i = 0; i < blitzPairs; i++) {
        matchups.push({
          type: "pass_rush",
          attacker: blitzers[i],
          defender: extraBlockers[i],
        });
      }
    }

    const coverDBs = coveragePlayers.filter((p) =>
      p.neutralBucket === "CB" || p.neutralBucket === "S"
    );
    const routePairs = Math.min(receivers.length, coverDBs.length);
    for (let i = 0; i < routePairs; i++) {
      matchups.push({
        type: "route_coverage",
        attacker: receivers[i],
        defender: coverDBs[i],
      });
    }
  }

  return matchups;
}

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
): PlayEvent {
  const isRunPlay = RUN_CONCEPTS.has(call.concept);
  const avgScore = contributions.length > 0
    ? contributions.reduce((sum, c) => sum + c.score, 0) / contributions.length
    : 0;

  const participants = contributions.map((c) => ({
    role: c.matchup.type,
    playerId: c.matchup.attacker.playerId,
    tags: [] as string[],
  }));

  const tags: PlayTag[] = [];
  let outcome: PlayOutcome;
  let yardage: number;

  if (isRunPlay) {
    const blockingContribs = contributions.filter(
      (c) => c.matchup.type === "run_block" || c.matchup.type === "run_defense",
    );
    const blockScore = blockingContribs.length > 0
      ? blockingContribs.reduce((s, c) => s + c.score, 0) /
        blockingContribs.length
      : avgScore;

    if (blockScore < -20) {
      yardage = rng.int(-3, 0);
    } else if (blockScore < -5) {
      yardage = rng.int(0, 3);
    } else if (blockScore > 15) {
      yardage = rng.int(8, 25);
      tags.push("big_play");
    } else {
      yardage = rng.int(2, 7);
    }

    if (rng.next() < 0.015) {
      outcome = "fumble";
      tags.push("fumble", "turnover");
    } else {
      outcome = "rush";
    }

    if (yardage >= state.situation.distance) {
      tags.push("first_down");
    }

    const rb = contributions.find(
      (c) => c.matchup.attacker.neutralBucket === "RB",
    );
    if (rb) {
      const idx = participants.findIndex(
        (p) => p.playerId === rb.matchup.attacker.playerId,
      );
      if (idx >= 0) participants[idx].tags.push("ball_carrier");
    }
  } else {
    const protectionContribs = contributions.filter(
      (c) =>
        c.matchup.type === "pass_protection" ||
        c.matchup.type === "pass_rush",
    );
    const protectionScore = protectionContribs.length > 0
      ? protectionContribs.reduce((s, c) => s + c.score, 0) /
        protectionContribs.length
      : avgScore;

    if (protectionScore < -15) {
      outcome = "sack";
      yardage = rng.int(-10, -3);
      tags.push("sack", "pressure");

      const rusher = contributions.find((c) =>
        c.matchup.type === "pass_rush" ||
        (c.matchup.type === "pass_protection" &&
          c.score < 0)
      );
      if (rusher) {
        const idx = participants.findIndex(
          (p) => p.playerId === rusher.matchup.defender.playerId,
        );
        if (idx >= 0) {
          participants[idx].tags.push("sack");
        } else {
          participants.push({
            role: "pass_rush",
            playerId: rusher.matchup.defender.playerId,
            tags: ["sack"],
          });
        }
      }

      if (rng.next() < 0.08) {
        outcome = "fumble";
        tags.push("fumble", "turnover");
      }
    } else {
      if (protectionScore < -5) {
        tags.push("pressure");
      }

      const routeContribs = contributions.filter(
        (c) => c.matchup.type === "route_coverage",
      );
      const coverageScore = routeContribs.length > 0
        ? routeContribs.reduce((s, c) => s + c.score, 0) /
          routeContribs.length
        : avgScore;

      if (coverageScore > 10) {
        outcome = "pass_complete";
        yardage = rng.int(8, 30);
        tags.push("big_play");
        const target = routeContribs.find((c) => c.score > 0);
        if (target) {
          const idx = participants.findIndex(
            (p) => p.playerId === target.matchup.attacker.playerId,
          );
          if (idx >= 0) participants[idx].tags.push("target", "reception");
        }
      } else if (coverageScore > -5) {
        outcome = "pass_complete";
        yardage = rng.int(3, 12);
        const target = routeContribs[0];
        if (target) {
          const idx = participants.findIndex(
            (p) => p.playerId === target.matchup.attacker.playerId,
          );
          if (idx >= 0) participants[idx].tags.push("target", "reception");
        }
      } else if (coverageScore < -15 && rng.next() < 0.15) {
        outcome = "interception";
        yardage = 0;
        tags.push("interception", "turnover");

        const interceptor = routeContribs.find((c) => c.score < -10);
        if (interceptor) {
          const idx = participants.findIndex(
            (p) => p.playerId === interceptor.matchup.defender.playerId,
          );
          if (idx >= 0) {
            participants[idx].tags.push("interception");
          } else {
            participants.push({
              role: "route_coverage",
              playerId: interceptor.matchup.defender.playerId,
              tags: ["interception"],
            });
          }
        }
      } else {
        outcome = "pass_incomplete";
        yardage = 0;
      }

      if (
        outcome === "pass_complete" && yardage >= state.situation.distance
      ) {
        tags.push("first_down");
      }
    }
  }

  if (rng.next() < 0.05) {
    tags.push("penalty");
  }

  if (rng.next() < 0.005) {
    tags.push("injury");
  }

  const yardsToEndzone = 100 - state.situation.yardLine;
  if (yardage >= yardsToEndzone && !tags.includes("turnover")) {
    outcome = "touchdown";
    yardage = yardsToEndzone;
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
    outcome: outcome!,
    yardage: yardage!,
    tags,
  };
}

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

  return synthesizeOutcome(call, coverage, contributions, state, rng);
}
