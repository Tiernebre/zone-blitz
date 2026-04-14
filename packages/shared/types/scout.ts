export type ScoutRole =
  | "DIRECTOR"
  | "NATIONAL_CROSS_CHECKER"
  | "AREA_SCOUT";

export type ScoutEvaluationLevel = "quick" | "standard" | "deep";

export type ScoutEvaluationOutcome =
  | "starter"
  | "contributor"
  | "bust"
  | "unknown";

export type ScoutRoundTier = "1-3" | "4-5" | "6-7" | "UDFA";

export type ScoutCrossCheckWinner = "this" | "other" | "tie" | "pending";

export type ScoutConnectionRelation = "worked_under" | "peer" | "mentee";

export interface ScoutSummary {
  id: string;
  firstName: string;
  lastName: string;
  role: ScoutRole;
}

/**
 * A node in the staff tree. Flat shape with `reportsToId`; the client
 * assembles the hierarchy. Per the scouting north-star, no accuracy /
 * grade / OVR — `workCapacity` is the single practical constraint that
 * is NOT hidden.
 */
export interface ScoutNode {
  id: string;
  firstName: string;
  lastName: string;
  role: ScoutRole;
  reportsToId: string | null;
  coverage: string | null;
  age: number;
  yearsWithTeam: number;
  contractYearsRemaining: number;
  workCapacity: number;
  isVacancy: boolean;
}

export interface ScoutCareerStop {
  id: string;
  orgName: string;
  role: string;
  startYear: number;
  endYear: number | null;
  coverageNotes: string | null;
}

export interface ScoutEvaluation {
  id: string;
  prospectId: string | null;
  prospectName: string;
  draftYear: number;
  positionGroup: string;
  schemeArchetype: string | null;
  roundTier: ScoutRoundTier;
  grade: string;
  evaluationLevel: ScoutEvaluationLevel;
  outcome: ScoutEvaluationOutcome;
  outcomeDetail: string | null;
}

export interface ScoutCrossCheck {
  id: string;
  evaluationId: string;
  otherScout: ScoutSummary | null;
  otherGrade: string;
  winner: ScoutCrossCheckWinner;
}

export interface ScoutExternalTrackRecord {
  id: string;
  orgName: string;
  startYear: number;
  endYear: number | null;
  noisyHitRateLabel: string;
}

export interface ScoutConnection {
  relation: ScoutConnectionRelation;
  scout: ScoutSummary;
}

/**
 * Full public-record detail payload. Resume, reputation labels (strings,
 * never numeric), tenure evaluations with actual outcomes attached,
 * cross-check history, external org record, and connections. Hidden
 * attribute tables must never be joined in.
 */
export interface ScoutDetail {
  id: string;
  leagueId: string;
  teamId: string;
  firstName: string;
  lastName: string;
  role: ScoutRole;
  coverage: string | null;
  age: number;
  yearsWithTeam: number;
  contractYearsRemaining: number;
  contractSalary: number;
  contractBuyout: number;
  workCapacity: number;
  isVacancy: boolean;
  reputationLabels: string[];
  careerStops: ScoutCareerStop[];
  evaluations: ScoutEvaluation[];
  crossChecks: ScoutCrossCheck[];
  externalTrackRecord: ScoutExternalTrackRecord[];
  connections: ScoutConnection[];
}

export interface Scout {
  id: string;
  leagueId: string;
  teamId: string;
  firstName: string;
  lastName: string;
  role: ScoutRole;
  reportsToId: string | null;
  coverage: string | null;
  age: number;
  hiredAt: Date;
  contractYears: number;
  contractSalary: number;
  contractBuyout: number;
  workCapacity: number;
  isVacancy: boolean;
  createdAt: Date;
  updatedAt: Date;
}
