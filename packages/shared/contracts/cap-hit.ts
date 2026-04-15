import type { ContractBonusSource } from "../types/player.ts";

export interface CapHitContractYear {
  leagueYear: number;
  base: number;
  rosterBonus: number;
  workoutBonus: number;
  perGameRosterBonus: number;
  isVoid: boolean;
}

export interface CapHitBonusProration {
  amount: number;
  firstYear: number;
  years: number;
  source: ContractBonusSource;
}

export interface CapHitContract {
  years: CapHitContractYear[];
  bonusProrations: CapHitBonusProration[];
}

export function computeCapHit(contract: CapHitContract, year: number): number {
  const yearRow = contract.years.find((y) => y.leagueYear === year);
  if (!yearRow) return 0;

  const proratedPortion = contract.bonusProrations
    .filter((p) => year >= p.firstYear && year < p.firstYear + p.years)
    .reduce((sum, p) => {
      const perYear = Math.floor(p.amount / p.years);
      const isLastYear = year === p.firstYear + p.years - 1;
      return sum + (isLastYear ? p.amount - perYear * (p.years - 1) : perYear);
    }, 0);

  if (yearRow.isVoid) return proratedPortion;

  return (
    yearRow.base +
    yearRow.rosterBonus +
    yearRow.workoutBonus +
    yearRow.perGameRosterBonus +
    proratedPortion
  );
}
