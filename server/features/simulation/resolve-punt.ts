import type { SeededRng } from "./rng.ts";
import type { PlayerRuntime } from "./resolve-play.ts";

export type PuntOutcome =
  | "fair_catch"
  | "return"
  | "downed_inside_10"
  | "touchback"
  | "muffed_punt"
  | "blocked_punt";

export interface PuntResult {
  outcome: PuntOutcome;
  netYards: number;
  landingYardLine: number;
  returnYards?: number;
}

export interface PuntInput {
  punter: PlayerRuntime;
  returner: PlayerRuntime;
  coverageUnit: PlayerRuntime[];
  yardLine: number;
  rng: SeededRng;
}

// ── Punt calibration knobs ────────────────────────────────────────────
const PUNT_DISTANCE = {
  baseMean: 35,
  powerScale: 20,
  baseStddev: 8,
  accuracyScale: 4,
  floor: 20,
  ceiling: 65,
} as const;

const PUNT_OUTCOME = {
  block: { floor: 0.005, base: 0.03, accuracyScale: 0.025 },
  muff: { base: 0.02, agilityScale: 0.03 },
  downedInside10: { base: 0.3, accuracyScale: 0.3, zoneThreshold: 90 },
  fairCatch: { base: 0.3, coverageScale: 0.3, floor: 0.1, ceiling: 0.7 },
  return: {
    baseMean: 5,
    ratingScale: 15,
    coveragePenaltyScale: 8,
    meanFloor: 2,
    stddev: 5,
    floor: 1,
    ceiling: 40,
  },
} as const;

function averageAttribute(
  players: PlayerRuntime[],
  attr: string,
): number {
  if (players.length === 0) return 50;
  let sum = 0;
  for (const p of players) {
    sum += (p.attributes as unknown as Record<string, number>)[attr] ?? 50;
  }
  return sum / players.length;
}

function computePuntDistance(punter: PlayerRuntime, rng: SeededRng): number {
  const power = (punter.attributes as unknown as Record<string, number>)
    .puntingPower ?? 50;
  const accuracy = (punter.attributes as unknown as Record<string, number>)
    .puntingAccuracy ?? 50;
  const baseMean = PUNT_DISTANCE.baseMean +
    (power / 100) * PUNT_DISTANCE.powerScale;
  const baseStddev = PUNT_DISTANCE.baseStddev -
    (accuracy / 100) * PUNT_DISTANCE.accuracyScale;
  return rng.gaussian(
    baseMean,
    baseStddev,
    PUNT_DISTANCE.floor,
    PUNT_DISTANCE.ceiling,
  );
}

function selectOutcome(
  punter: PlayerRuntime,
  returner: PlayerRuntime,
  coverageUnit: PlayerRuntime[],
  rawLanding: number,
  rng: SeededRng,
): PuntOutcome {
  const punterAccuracy =
    (punter.attributes as unknown as Record<string, number>).puntingAccuracy ??
      50;
  const coverageSpeed = averageAttribute(coverageUnit, "speed");
  const coverageAccel = averageAttribute(coverageUnit, "acceleration");
  const coverageRating = (coverageSpeed + coverageAccel) / 2;
  const returnerAgility =
    (returner.attributes as unknown as Record<string, number>).agility ?? 50;

  const blockChance = Math.max(
    PUNT_OUTCOME.block.floor,
    PUNT_OUTCOME.block.base -
      (punterAccuracy / 100) * PUNT_OUTCOME.block.accuracyScale,
  );
  const roll = rng.next();

  if (roll < blockChance) return "blocked_punt";

  const muffChance = PUNT_OUTCOME.muff.base +
    (1 - returnerAgility / 100) * PUNT_OUTCOME.muff.agilityScale;
  if (roll < blockChance + muffChance) return "muffed_punt";

  if (rawLanding >= 100) return "touchback";

  if (rawLanding >= PUNT_OUTCOME.downedInside10.zoneThreshold) {
    const downedChance = PUNT_OUTCOME.downedInside10.base +
      (punterAccuracy / 100) * PUNT_OUTCOME.downedInside10.accuracyScale;
    if (rng.next() < downedChance) return "downed_inside_10";
    return "touchback";
  }

  const coverageBonus = (coverageRating - 50) / 100 *
    PUNT_OUTCOME.fairCatch.coverageScale;
  const fairCatchChance = Math.max(
    PUNT_OUTCOME.fairCatch.floor,
    Math.min(
      PUNT_OUTCOME.fairCatch.ceiling,
      PUNT_OUTCOME.fairCatch.base + coverageBonus,
    ),
  );
  if (rng.next() < fairCatchChance) return "fair_catch";

  return "return";
}

export function resolvePunt(input: PuntInput): PuntResult {
  const { punter, returner, coverageUnit, yardLine, rng } = input;

  const puntDistance = computePuntDistance(punter, rng);
  const rawLanding = yardLine + puntDistance;

  const outcome = selectOutcome(
    punter,
    returner,
    coverageUnit,
    rawLanding,
    rng,
  );

  switch (outcome) {
    case "blocked_punt":
      return { outcome, netYards: 0, landingYardLine: yardLine };

    case "muffed_punt": {
      const landing = Math.min(99, Math.max(1, Math.round(rawLanding)));
      return {
        outcome,
        netYards: landing - yardLine,
        landingYardLine: landing,
      };
    }

    case "touchback":
      return {
        outcome,
        netYards: 80 - yardLine,
        landingYardLine: 80,
      };

    case "downed_inside_10": {
      const landing = rng.int(90, 99);
      return {
        outcome,
        netYards: landing - yardLine,
        landingYardLine: landing,
      };
    }

    case "fair_catch": {
      const landing = Math.min(99, Math.max(1, Math.round(rawLanding)));
      return {
        outcome,
        netYards: landing - yardLine,
        landingYardLine: landing,
      };
    }

    case "return": {
      const landing = Math.min(99, Math.max(1, Math.round(rawLanding)));
      const returnerSpeed =
        (returner.attributes as unknown as Record<string, number>).speed ?? 50;
      const returnerAccel =
        (returner.attributes as unknown as Record<string, number>)
          .acceleration ?? 50;
      const returnerRating = (returnerSpeed + returnerAccel) / 2;
      const coverageSpeed = averageAttribute(coverageUnit, "speed");

      const returnBase = PUNT_OUTCOME.return.baseMean +
        (returnerRating / 100) * PUNT_OUTCOME.return.ratingScale;
      const coveragePenalty = (coverageSpeed / 100) *
        PUNT_OUTCOME.return.coveragePenaltyScale;
      const returnMean = Math.max(
        PUNT_OUTCOME.return.meanFloor,
        returnBase - coveragePenalty,
      );

      const returnYards = rng.gaussian(
        returnMean,
        PUNT_OUTCOME.return.stddev,
        PUNT_OUTCOME.return.floor,
        PUNT_OUTCOME.return.ceiling,
      );
      const netLanding = Math.max(1, landing - returnYards);
      const netYards = netLanding - yardLine;

      return {
        outcome,
        netYards,
        landingYardLine: netLanding,
        returnYards,
      };
    }
  }
}
