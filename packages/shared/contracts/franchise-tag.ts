import type {
  ContractGuaranteeType,
  ContractTagType,
} from "../types/player.ts";
import type { CapBonusProration } from "./cap-engine.ts";

export interface TagContractInput {
  playerId: string;
  teamId: string;
  tagType: ContractTagType;
  baseSalary: number;
  leagueYear: number;
}

export interface TagContractYear {
  leagueYear: number;
  base: number;
  rosterBonus: number;
  workoutBonus: number;
  perGameRosterBonus: number;
  guaranteeType: ContractGuaranteeType;
  isVoid: boolean;
}

export interface TagContract {
  playerId: string;
  teamId: string;
  signedYear: number;
  totalYears: number;
  realYears: number;
  signingBonus: number;
  isRookieDeal: boolean;
  rookieDraftPick: number | null;
  tagType: ContractTagType;
}

export interface TagContractBundle {
  contract: TagContract;
  years: TagContractYear[];
  bonusProrations: CapBonusProration[];
}

export function computeTagSalary(positionalSalaries: number[]): number {
  if (positionalSalaries.length === 0) {
    throw new Error("computeTagSalary requires at least one salary");
  }

  const sorted = [...positionalSalaries].sort((a, b) => b - a);
  const topN = sorted.slice(0, 5);
  const sum = topN.reduce((total, s) => total + s, 0);
  return Math.floor(sum / topN.length);
}

export function createTagContract(input: TagContractInput): TagContractBundle {
  return {
    contract: {
      playerId: input.playerId,
      teamId: input.teamId,
      signedYear: input.leagueYear,
      totalYears: 1,
      realYears: 1,
      signingBonus: 0,
      isRookieDeal: false,
      rookieDraftPick: null,
      tagType: input.tagType,
    },
    years: [
      {
        leagueYear: input.leagueYear,
        base: input.baseSalary,
        rosterBonus: 0,
        workoutBonus: 0,
        perGameRosterBonus: 0,
        guaranteeType: "full",
        isVoid: false,
      },
    ],
    bonusProrations: [],
  };
}
