export type CoachRole =
  | "HC"
  | "OC"
  | "DC"
  | "STC"
  | "QB"
  | "RB"
  | "WR"
  | "TE"
  | "OL"
  | "DL"
  | "LB"
  | "DB"
  | "ST_ASSISTANT";

export type CoachPlayCaller = "offense" | "defense" | "ceo";

export type CoachSpecialty =
  | "offense"
  | "defense"
  | "special_teams"
  | "quarterbacks"
  | "running_backs"
  | "wide_receivers"
  | "tight_ends"
  | "offensive_line"
  | "defensive_line"
  | "linebackers"
  | "defensive_backs"
  | "ceo";

export interface Coach {
  id: string;
  leagueId: string;
  teamId: string;
  firstName: string;
  lastName: string;
  role: CoachRole;
  reportsToId: string | null;
  playCaller: CoachPlayCaller | null;
  age: number;
  hiredAt: Date;
  contractYears: number;
  contractSalary: number;
  contractBuyout: number;
  collegeId: string | null;
  specialty: CoachSpecialty | null;
  isVacancy: boolean;
  mentorCoachId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
