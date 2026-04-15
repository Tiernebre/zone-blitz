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
  const baseMean = 35 + (power / 100) * 20;
  const baseStddev = 8 - (accuracy / 100) * 4;
  return rng.gaussian(baseMean, baseStddev, 20, 65);
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

  const blockChance = Math.max(0.005, 0.03 - (punterAccuracy / 100) * 0.025);
  const roll = rng.next();

  if (roll < blockChance) return "blocked_punt";

  const muffBase = 0.02;
  const muffChance = muffBase + (1 - returnerAgility / 100) * 0.03;
  if (roll < blockChance + muffChance) return "muffed_punt";

  if (rawLanding >= 100) return "touchback";

  if (rawLanding >= 90) {
    const downedChance = 0.3 + (punterAccuracy / 100) * 0.3;
    if (rng.next() < downedChance) return "downed_inside_10";
    return "touchback";
  }

  const fairCatchBase = 0.3;
  const coverageBonus = (coverageRating - 50) / 100 * 0.3;
  const fairCatchChance = Math.max(
    0.1,
    Math.min(0.7, fairCatchBase + coverageBonus),
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

      const returnBase = 5 + (returnerRating / 100) * 15;
      const coveragePenalty = (coverageSpeed / 100) * 8;
      const returnMean = Math.max(2, returnBase - coveragePenalty);

      const returnYards = rng.gaussian(returnMean, 5, 1, 40);
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
