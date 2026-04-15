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

export interface BonusProration {
  amount: number;
  firstYear: number;
  years: number;
  source: ContractBonusSource;
}

export interface CapContract {
  signedYear: number;
  totalYears: number;
  years: CapContractYear[];
  bonusProrations: BonusProration[];
}

function prorationForYear(p: BonusProration, year: number): number {
  if (year < p.firstYear || year >= p.firstYear + p.years) return 0;
  const perYear = Math.floor(p.amount / p.years);
  const lastYear = p.firstYear + p.years - 1;
  if (year === lastYear) {
    return p.amount - perYear * (p.years - 1);
  }
  return perYear;
}

function sumProrations(
  prorations: BonusProration[],
  year: number,
): number {
  return prorations.reduce((sum, p) => sum + prorationForYear(p, year), 0);
}

export function computeCapHit(contract: CapContract, year: number): number {
  const yearRow = contract.years.find((y) => y.leagueYear === year);
  if (!yearRow) return 0;

  const proratedPortion = sumProrations(contract.bonusProrations, year);

  if (yearRow.isVoid) return proratedPortion;

  return (
    yearRow.base +
    yearRow.rosterBonus +
    yearRow.workoutBonus +
    yearRow.perGameRosterBonus +
    proratedPortion
  );
}

export function computeDeadCap(contract: CapContract, cutYear: number): number {
  const acceleratedBonus = contract.bonusProrations
    .map((p) => {
      let total = 0;
      for (let y = cutYear; y < p.firstYear + p.years; y++) {
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

export function restructureContract(
  contract: CapContract,
  year: number,
  amount: number,
): CapContract {
  const lastLeagueYear = Math.max(...contract.years.map((y) => y.leagueYear));
  const remainingYears = lastLeagueYear - year + 1;
  const prorationYears = Math.min(5, remainingYears);

  const newYears = contract.years.map((y) => {
    if (y.leagueYear === year) {
      return { ...y, base: y.base - amount };
    }
    return { ...y };
  });

  const newProration: BonusProration = {
    amount,
    firstYear: year,
    years: prorationYears,
    source: "restructure",
  };

  return {
    ...contract,
    years: newYears,
    bonusProrations: [...contract.bonusProrations, newProration],
  };
}
