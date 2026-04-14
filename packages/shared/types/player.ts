export const PLAYER_POSITIONS = [
  "QB",
  "RB",
  "FB",
  "WR",
  "TE",
  "OL",
  "DL",
  "LB",
  "CB",
  "S",
  "K",
  "P",
  "LS",
] as const;

export type PlayerPosition = (typeof PLAYER_POSITIONS)[number];

export const PLAYER_POSITION_GROUPS: Record<
  "offense" | "defense" | "special_teams",
  readonly PlayerPosition[]
> = {
  offense: ["QB", "RB", "FB", "WR", "TE", "OL"],
  defense: ["DL", "LB", "CB", "S"],
  special_teams: ["K", "P", "LS"],
};

export const PLAYER_INJURY_STATUSES = [
  "healthy",
  "questionable",
  "doubtful",
  "out",
  "ir",
  "pup",
] as const;

export type PlayerInjuryStatus = (typeof PLAYER_INJURY_STATUSES)[number];

export interface Player {
  id: string;
  leagueId: string;
  teamId: string | null;
  firstName: string;
  lastName: string;
  position: PlayerPosition;
  injuryStatus: PlayerInjuryStatus;
  heightInches: number;
  weightPounds: number;
  college: string | null;
  hometown: string | null;
  birthDate: string;
  draftYear: number | null;
  draftRound: number | null;
  draftPick: number | null;
  draftingTeamId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlayerOrigin {
  draftYear: number | null;
  draftRound: number | null;
  draftPick: number | null;
  draftingTeam: {
    id: string;
    name: string;
    city: string;
    abbreviation: string;
  } | null;
  college: string | null;
  hometown: string | null;
}

export interface PlayerDetail {
  id: string;
  firstName: string;
  lastName: string;
  position: PlayerPosition;
  age: number;
  heightInches: number;
  weightPounds: number;
  yearsOfExperience: number;
  injuryStatus: PlayerInjuryStatus;
  currentTeam: {
    id: string;
    name: string;
    city: string;
    abbreviation: string;
  } | null;
  origin: PlayerOrigin;
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
  position: PlayerPosition;
  heightInches: number;
  weightPounds: number;
  college: string | null;
  birthDate: string;
  createdAt: Date;
  updatedAt: Date;
}
