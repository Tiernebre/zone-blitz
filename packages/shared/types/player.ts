export interface Player {
  id: string;
  leagueId: string;
  teamId: string | null;
  firstName: string;
  lastName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Contract {
  id: string;
  playerId: string;
  teamId: string;
  totalYears: number;
  currentYear: number;
  totalSalary: number;
  annualSalary: number;
  guaranteedMoney: number;
  signingBonus: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DraftProspect {
  id: string;
  seasonId: string;
  firstName: string;
  lastName: string;
  createdAt: Date;
  updatedAt: Date;
}
