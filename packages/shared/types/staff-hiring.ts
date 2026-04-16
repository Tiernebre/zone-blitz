export type HiringStaffType = "coach" | "scout";

export type HiringInterestStatus = "active" | "withdrawn";

export type HiringInterviewStatus =
  | "requested"
  | "accepted"
  | "declined"
  | "completed";

export type HiringOfferStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "expired";

export interface HiringCandidateSummary {
  id: string;
  leagueId: string;
  staffType: HiringStaffType;
  firstName: string;
  lastName: string;
  role: string;
}

export interface HiringInterviewReveal {
  philosophyReveal: unknown;
  staffFitReveal: unknown;
}

export interface HiringCandidateDetail extends HiringCandidateSummary {
  marketTierPref: number | null;
  philosophyFitPref: number | null;
  staffFitPref: number | null;
  compensationPref: number | null;
  minimumThreshold: number | null;
  interviewReveal: HiringInterviewReveal | null;
}

export interface HiringIncentive {
  type: string;
  value: number;
}

export interface HiringOfferInput {
  candidateId: string;
  salary: number;
  contractYears: number;
  buyoutMultiplier: string;
  incentives?: HiringIncentive[];
}

export interface HiringStateResponse {
  leagueId: string;
  teamId: string;
  staffBudget: number;
  remainingBudget: number;
  interests: HiringInterestView[];
  interviews: HiringInterviewView[];
  offers: HiringOfferView[];
  decisions: HiringDecisionView[];
}

export interface HiringInterestView {
  id: string;
  leagueId: string;
  teamId: string;
  staffType: HiringStaffType;
  staffId: string;
  stepSlug: string;
  status: HiringInterestStatus;
}

export interface HiringInterviewView {
  id: string;
  leagueId: string;
  teamId: string;
  staffType: HiringStaffType;
  staffId: string;
  stepSlug: string;
  status: HiringInterviewStatus;
}

export interface HiringOfferView {
  id: string;
  leagueId: string;
  teamId: string;
  staffType: HiringStaffType;
  staffId: string;
  stepSlug: string;
  status: HiringOfferStatus;
  salary: number;
  contractYears: number;
  buyoutMultiplier: string;
}

export interface HiringDecisionView {
  id: string;
  leagueId: string;
  staffType: HiringStaffType;
  staffId: string;
  chosenOfferId: string | null;
  wave: number;
}
