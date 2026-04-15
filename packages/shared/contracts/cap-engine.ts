import type {
  ContractBonusSource,
  ContractGuaranteeType,
} from "../types/player.ts";

export interface CapContractYear {
  leagueYear: number;
  base: number;
  rosterBonus: number;
  workoutBonus: number;
  perGameRosterBonus: number;
  guaranteeType: ContractGuaranteeType;
  isVoid: boolean;
}

export interface CapBonusProration {
  amount: number;
  firstYear: number;
  years: number;
  source: ContractBonusSource;
}

export interface CapOptionBonus {
  amount: number;
  exerciseYear: number;
  prorationYears: number;
  exercisedAt: Date | null;
}

export interface CapContractInput {
  years: CapContractYear[];
  bonusProrations: CapBonusProration[];
  optionBonuses: CapOptionBonus[];
}

function prorationForYear(
  proration: CapBonusProration,
  year: number,
): number {
  if (
    year < proration.firstYear || year >= proration.firstYear + proration.years
  ) {
    return 0;
  }
  const perYear = Math.floor(proration.amount / proration.years);
  const isLastYear = year === proration.firstYear + proration.years - 1;
  if (isLastYear) {
    return proration.amount - perYear * (proration.years - 1);
  }
  return perYear;
}

export function computeCapHit(
  contract: CapContractInput,
  year: number,
): number {
  const yearRow = contract.years.find((y) => y.leagueYear === year);
  if (!yearRow) return 0;

  const proratedPortion = contract.bonusProrations
    .map((p) => prorationForYear(p, year))
    .reduce((sum, v) => sum + v, 0);

  if (yearRow.isVoid) return proratedPortion;

  return (
    yearRow.base +
    yearRow.rosterBonus +
    yearRow.workoutBonus +
    yearRow.perGameRosterBonus +
    proratedPortion
  );
}

export function computeDeadCap(
  contract: CapContractInput,
  cutYear: number,
): number {
  const acceleratedBonus = contract.bonusProrations
    .map((p) => {
      const endYear = p.firstYear + p.years;
      const yearsRemaining = Math.max(0, endYear - cutYear);
      if (yearsRemaining === 0) return 0;
      let total = 0;
      for (let y = cutYear; y < endYear; y++) {
        total += prorationForYear(p, y);
      }
      return total;
    })
    .reduce((sum, v) => sum + v, 0);

  const remainingGuaranteedBase = contract.years
    .filter((y) => y.leagueYear >= cutYear && y.guaranteeType === "full")
    .reduce((sum, y) => sum + y.base + y.rosterBonus, 0);

  return acceleratedBonus + remainingGuaranteedBase;
}

export function computeHeadlineValue(contract: CapContractInput): number {
  const yearTotals = contract.years.reduce(
    (sum, y) =>
      sum +
      y.base +
      y.rosterBonus +
      y.workoutBonus +
      y.perGameRosterBonus,
    0,
  );

  const materializedBonuses = contract.bonusProrations.reduce(
    (sum, p) => sum + p.amount,
    0,
  );

  const unexercisedOptionFace = contract.optionBonuses
    .filter((o) => o.exercisedAt === null)
    .reduce((sum, o) => sum + o.amount, 0);

  return yearTotals + materializedBonuses + unexercisedOptionFace;
}
