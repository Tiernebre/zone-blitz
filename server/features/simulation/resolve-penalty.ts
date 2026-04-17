import type { NeutralBucket } from "@zone-blitz/shared";
import type { PenaltyInfo, PenaltyPhase, PenaltyType } from "./events.ts";
import type { SeededRng } from "./rng.ts";
import type { Situation } from "./resolve-play.ts";

export interface PenaltyCandidate {
  type: PenaltyType;
  phase: PenaltyPhase;
  yardage: number;
  automaticFirstDown: boolean;
  side: "offense" | "defense";
  positionTendencies: NeutralBucket[];
  weight: number;
}

export interface PenaltyContext {
  offenseTeamId: string;
  defenseTeamId: string;
  offensePositions: NeutralBucket[];
  defensePositions: NeutralBucket[];
  offensePlayerIds: string[];
  defensePlayerIds: string[];
  isRunPlay: boolean;
  playYardage: number;
  playGainedFirstDown: boolean;
  situation: Situation;
}

export interface AcceptanceContext {
  playYardage: number;
  playGainedFirstDown: boolean;
  situation: Situation;
  offenseTeamId: string;
}

export const PENALTY_CATALOG: PenaltyCandidate[] = [
  // Pre-snap (always offense)
  {
    type: "false_start",
    phase: "pre_snap",
    yardage: 5,
    automaticFirstDown: false,
    side: "offense",
    positionTendencies: ["OT", "IOL", "TE"],
    weight: 3,
  },
  {
    type: "delay_of_game",
    phase: "pre_snap",
    yardage: 5,
    automaticFirstDown: false,
    side: "offense",
    positionTendencies: ["QB"],
    weight: 1,
  },
  {
    type: "offsides",
    phase: "pre_snap",
    yardage: 5,
    automaticFirstDown: false,
    side: "offense",
    positionTendencies: ["WR", "RB", "TE"],
    weight: 0.5,
  },
  {
    type: "encroachment",
    phase: "pre_snap",
    yardage: 5,
    automaticFirstDown: false,
    side: "offense",
    positionTendencies: ["OT", "IOL"],
    weight: 0.5,
  },
  {
    type: "neutral_zone_infraction",
    phase: "pre_snap",
    yardage: 5,
    automaticFirstDown: false,
    side: "offense",
    positionTendencies: ["OT", "IOL"],
    weight: 0.5,
  },
  // Post-snap offense
  {
    type: "holding",
    phase: "post_snap",
    yardage: 10,
    automaticFirstDown: false,
    side: "offense",
    positionTendencies: ["OT", "IOL", "TE", "RB"],
    weight: 5,
  },
  {
    type: "pass_interference",
    phase: "post_snap",
    yardage: 15,
    automaticFirstDown: false,
    side: "offense",
    positionTendencies: ["WR", "TE"],
    weight: 0.5,
  },
  {
    type: "illegal_block_in_the_back",
    phase: "post_snap",
    yardage: 10,
    automaticFirstDown: false,
    side: "offense",
    positionTendencies: ["WR", "RB", "TE"],
    weight: 1,
  },
  {
    type: "illegal_use_of_hands",
    phase: "post_snap",
    yardage: 10,
    automaticFirstDown: false,
    side: "offense",
    positionTendencies: ["OT", "IOL"],
    weight: 1,
  },
  // Post-snap defense
  {
    type: "defensive_holding",
    phase: "post_snap",
    yardage: 5,
    automaticFirstDown: true,
    side: "defense",
    positionTendencies: ["CB", "S", "LB"],
    weight: 3,
  },
  {
    type: "defensive_pass_interference",
    phase: "post_snap",
    yardage: 15,
    automaticFirstDown: true,
    side: "defense",
    positionTendencies: ["CB", "S"],
    weight: 3,
  },
  {
    type: "facemask",
    phase: "post_snap",
    yardage: 15,
    automaticFirstDown: true,
    side: "defense",
    positionTendencies: ["LB", "EDGE", "IDL", "CB", "S"],
    weight: 1,
  },
  {
    type: "roughing_the_passer",
    phase: "post_snap",
    yardage: 15,
    automaticFirstDown: true,
    side: "defense",
    positionTendencies: ["EDGE", "IDL", "LB"],
    weight: 1,
  },
  {
    type: "unnecessary_roughness",
    phase: "post_snap",
    yardage: 15,
    automaticFirstDown: true,
    side: "defense",
    positionTendencies: ["LB", "S", "EDGE"],
    weight: 0.5,
  },
  {
    type: "illegal_contact",
    phase: "post_snap",
    yardage: 5,
    automaticFirstDown: true,
    side: "defense",
    positionTendencies: ["CB", "S", "LB"],
    weight: 1,
  },
];

export const PER_PLAY_PENALTY_RATE = 0.017;

/**
 * `disciplineMultiplier` scales the base rate — 1.0 preserves the calibrated
 * baseline; lower values reflect disciplined teams (HC leadership), higher
 * values sloppy ones. Clamped to [0.5, 1.5] so a single coach can't erase
 * flags entirely.
 */
export function shouldPenaltyOccur(
  rng: SeededRng,
  disciplineMultiplier = 1,
): boolean {
  const clamped = Math.min(1.5, Math.max(0.5, disciplineMultiplier));
  return rng.next() < PER_PLAY_PENALTY_RATE * clamped;
}

export function pickPenalty(
  ctx: PenaltyContext,
  rng: SeededRng,
): PenaltyInfo | null {
  const candidates = buildWeightedCandidates(ctx);
  if (candidates.length === 0) return null;

  const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
  let roll = rng.next() * totalWeight;
  let selected: PenaltyCandidate | null = null;
  for (const c of candidates) {
    roll -= c.weight;
    if (roll <= 0) {
      selected = c;
      break;
    }
  }
  if (!selected) selected = candidates[candidates.length - 1];

  const againstTeamId = selected.side === "offense"
    ? ctx.offenseTeamId
    : ctx.defenseTeamId;

  const positions = selected.side === "offense"
    ? ctx.offensePositions
    : ctx.defensePositions;
  const playerIds = selected.side === "offense"
    ? ctx.offensePlayerIds
    : ctx.defensePlayerIds;

  const eligibleIndices: number[] = [];
  for (let i = 0; i < positions.length; i++) {
    if (selected.positionTendencies.includes(positions[i])) {
      eligibleIndices.push(i);
    }
  }

  let againstPlayerId: string | null = null;
  if (eligibleIndices.length > 0) {
    const idx = eligibleIndices[rng.int(0, eligibleIndices.length - 1)];
    againstPlayerId = playerIds[idx];
  } else if (playerIds.length > 0) {
    againstPlayerId = playerIds[rng.int(0, playerIds.length - 1)];
  }

  const accepted = decidePenaltyAcceptance(
    {
      type: selected.type,
      phase: selected.phase,
      yardage: selected.yardage,
      automaticFirstDown: selected.automaticFirstDown,
      againstTeamId,
      againstPlayerId,
      accepted: false,
    },
    {
      playYardage: ctx.playYardage,
      playGainedFirstDown: ctx.playGainedFirstDown,
      situation: ctx.situation,
      offenseTeamId: ctx.offenseTeamId,
    },
  );

  return {
    type: selected.type,
    phase: selected.phase,
    yardage: selected.yardage,
    automaticFirstDown: selected.automaticFirstDown,
    againstTeamId,
    againstPlayerId,
    accepted,
  };
}

export function decidePenaltyAcceptance(
  penalty: PenaltyInfo,
  ctx: AcceptanceContext,
): boolean {
  if (penalty.phase === "pre_snap") return true;

  const isAgainstOffense = penalty.againstTeamId === ctx.offenseTeamId;

  if (isAgainstOffense) {
    // Defense decides: accept if the play gained yardage (negating it helps)
    if (ctx.playYardage > 0) return true;
    if (ctx.playGainedFirstDown) return true;
    return false;
  } else {
    // Offense decides: accept if penalty yardage + first down is better than play result
    if (ctx.playYardage < 0) return true;
    if (!ctx.playGainedFirstDown && penalty.automaticFirstDown) return true;
    if (penalty.yardage > ctx.playYardage) return true;
    return false;
  }
}

function buildWeightedCandidates(ctx: PenaltyContext): PenaltyCandidate[] {
  const candidates: PenaltyCandidate[] = [];

  for (const entry of PENALTY_CATALOG) {
    let weight = entry.weight;

    const positions = entry.side === "offense"
      ? ctx.offensePositions
      : ctx.defensePositions;

    const hasMatchingPosition = positions.some((pos) =>
      entry.positionTendencies.includes(pos)
    );
    if (!hasMatchingPosition) {
      weight *= 0.1;
    }

    if (!ctx.isRunPlay && entry.type === "defensive_pass_interference") {
      weight *= 1.5;
    }
    if (ctx.isRunPlay && entry.type === "holding") {
      weight *= 1.3;
    }

    candidates.push({ ...entry, weight });
  }

  return candidates;
}
