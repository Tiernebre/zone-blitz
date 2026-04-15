export const CONTRACT_TYPES = [
  "rookie_scale",
  "veteran",
  "extension",
  "franchise_tag",
  "restructure",
] as const;

export type ContractType = (typeof CONTRACT_TYPES)[number];

export interface ContractYearRow {
  yearNumber: number;
  baseSalary: number;
  signingBonusProration: number;
  rosterBonus: number;
  workoutBonus: number;
  capHit: number;
  deadCap: number;
  cashPaid: number;
  isVoid: boolean;
}

export interface ContractYearInput {
  totalYears: number;
  annualSalary: number;
  signingBonus: number;
  guaranteedMoney: number;
  currentYear: number;
  voidYears?: number;
}

export interface ContractLedgerEntry {
  id: string;
  team: {
    id: string;
    name: string;
    city: string;
    abbreviation: string;
  };
  contractType: ContractType;
  signedInYear: number | null;
  totalYears: number;
  totalValue: number;
  guaranteedAtSigning: number;
  signingBonus: number;
  years: ContractYearRow[];
  isCurrent: boolean;
  terminationReason?: string;
  endedInYear?: number | null;
}

export function buildContractYears(
  input: ContractYearInput,
): ContractYearRow[] {
  const voidCount = input.voidYears ?? 0;
  const prorationYears = input.totalYears + voidCount;
  const proration = input.signingBonus > 0
    ? Math.floor(input.signingBonus / prorationYears)
    : 0;
  const baseSalary = input.annualSalary - proration;

  const rows: ContractYearRow[] = [];

  for (let i = 1; i <= input.totalYears; i++) {
    rows.push({
      yearNumber: i,
      baseSalary,
      signingBonusProration: proration,
      rosterBonus: 0,
      workoutBonus: 0,
      capHit: baseSalary + proration,
      deadCap: proration * (prorationYears - i + 1),
      cashPaid: i === 1 ? baseSalary + input.signingBonus : baseSalary,
      isVoid: false,
    });
  }

  for (let i = 0; i < voidCount; i++) {
    const yearNumber = input.totalYears + i + 1;
    rows.push({
      yearNumber,
      baseSalary: 0,
      signingBonusProration: proration,
      rosterBonus: 0,
      workoutBonus: 0,
      capHit: proration,
      deadCap: proration * (prorationYears - yearNumber + 1),
      cashPaid: 0,
      isVoid: true,
    });
  }

  return rows;
}
