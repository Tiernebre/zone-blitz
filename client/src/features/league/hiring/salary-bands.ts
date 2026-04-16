export interface SalaryBand {
  min: number;
  max: number;
}

export const COACH_SALARY_BANDS: Record<string, SalaryBand> = {
  HC: { min: 5_000_000, max: 20_000_000 },
  OC: { min: 1_500_000, max: 6_000_000 },
  DC: { min: 1_500_000, max: 5_000_000 },
  STC: { min: 800_000, max: 2_000_000 },
  QB: { min: 500_000, max: 1_500_000 },
  RB: { min: 300_000, max: 1_200_000 },
  WR: { min: 300_000, max: 1_200_000 },
  TE: { min: 300_000, max: 1_200_000 },
  OL: { min: 300_000, max: 1_200_000 },
  DL: { min: 300_000, max: 1_200_000 },
  LB: { min: 300_000, max: 1_200_000 },
  DB: { min: 300_000, max: 1_200_000 },
  ST_ASSISTANT: { min: 250_000, max: 600_000 },
};

export const SCOUT_SALARY_BANDS: Record<string, SalaryBand> = {
  DIRECTOR: { min: 250_000, max: 800_000 },
  NATIONAL_CROSS_CHECKER: { min: 150_000, max: 400_000 },
  AREA_SCOUT: { min: 80_000, max: 200_000 },
};

export function bandFor(
  staffType: "coach" | "scout",
  role: string,
): SalaryBand {
  if (staffType === "coach") {
    return COACH_SALARY_BANDS[role] ?? { min: 100_000, max: 1_000_000 };
  }
  return SCOUT_SALARY_BANDS[role] ?? { min: 50_000, max: 300_000 };
}

export function medianSalary(
  staffType: "coach" | "scout",
  role: string,
): number {
  const band = bandFor(staffType, role);
  return Math.round((band.min + band.max) / 2);
}

export function formatMoney(amount: number): string {
  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000;
    return `$${millions.toFixed(millions >= 10 ? 0 : 1)}M`;
  }
  if (amount >= 1_000) {
    return `$${Math.round(amount / 1_000)}K`;
  }
  return `$${amount}`;
}
