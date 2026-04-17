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

/**
 * Minimal coach reference used where a full Coach would be overkill —
 * e.g. a mentor stub, a connection target, or a coaching-tree lineage
 * node. Contains nothing the non-goals forbid (no OVR, no grade,
 * no attribute reveals).
 */
export interface CoachSummary {
  id: string;
  firstName: string;
  lastName: string;
  role: CoachRole;
}

export interface CoachCollege {
  id: string;
  shortName: string;
  nickname: string;
  conference: string;
}

/**
 * A node in the staff tree. Flat shape with `reportsToId`; the client
 * assembles the tree. No numeric rating, grade, tier, or OVR.
 */
export interface CoachNode {
  id: string;
  firstName: string;
  lastName: string;
  role: CoachRole;
  reportsToId: string | null;
  playCaller: CoachPlayCaller | null;
  specialty: CoachSpecialty | null;
  age: number;
  yearsWithTeam: number;
  contractYearsRemaining: number;
  isVacancy: boolean;
}

export interface CoachCareerStop {
  id: string;
  teamName: string;
  role: string;
  startYear: number;
  endYear: number | null;
  teamWins: number | null;
  teamLosses: number | null;
  teamTies: number | null;
  unitRank: number | null;
  unitSide: "offense" | "defense" | "special_teams" | null;
}

export interface CoachTenureUnitSeason {
  season: number;
  unitSide: "offense" | "defense" | "special_teams";
  rank: number;
  metrics: Record<string, unknown> | null;
}

export interface CoachTenurePlayerDev {
  playerId: string;
  season: number;
  delta: "improved" | "stagnated" | "regressed";
  note: string | null;
}

export interface CoachAccolade {
  id: string;
  season: number;
  type: "coy_vote" | "championship" | "position_pro_bowl" | "other";
  detail: string;
}

export interface CoachDepthChartNote {
  id: string;
  season: number;
  note: string;
}

export interface CoachConnection {
  relation: "mentor" | "mentee" | "peer";
  coach: CoachSummary;
}

/**
 * The full coach detail payload. Purely public record: bio fields,
 * resume, reputation labels (strings, never numeric), tenure results,
 * accolades, connections. Hidden-attribute tables must never be joined
 * into this aggregate.
 */
export interface CoachDetail {
  id: string;
  leagueId: string;
  teamId: string | null;
  firstName: string;
  lastName: string;
  role: CoachRole;
  specialty: CoachSpecialty | null;
  playCaller: CoachPlayCaller | null;
  age: number;
  yearsWithTeam: number;
  contractYearsRemaining: number;
  contractSalary: number;
  contractBuyout: number;
  isVacancy: boolean;
  college: CoachCollege | null;
  mentor: CoachSummary | null;
  reputationLabels: string[];
  careerStops: CoachCareerStop[];
  tenureUnitPerformance: CoachTenureUnitSeason[];
  tenurePlayerDev: CoachTenurePlayerDev[];
  accolades: CoachAccolade[];
  depthChartNotes: CoachDepthChartNote[];
  connections: CoachConnection[];
}

export interface Coach {
  id: string;
  leagueId: string;
  teamId: string | null;
  firstName: string;
  lastName: string;
  role: CoachRole;
  reportsToId: string | null;
  playCaller: CoachPlayCaller | null;
  age: number;
  yearsExperience: number;
  hiredAt: Date;
  contractYears: number;
  contractSalary: number;
  contractBuyout: number;
  collegeId: string | null;
  specialty: CoachSpecialty | null;
  positionBackground: string | null;
  isVacancy: boolean;
  mentorCoachId: string | null;
  marketTierPref: number | null;
  philosophyFitPref: number | null;
  staffFitPref: number | null;
  compensationPref: number | null;
  minimumThreshold: number | null;
  createdAt: Date;
  updatedAt: Date;
}
