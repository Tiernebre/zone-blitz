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
  /** Coach-only. Public knowledge: the side of the ball this coach
   * built his career on. Null for scouts. */
  specialty: string | null;
  /** Coach-only. Archetype name like `shanahan_wide_zone`. Populated for
   * coaches who carry an offensive scheme identity (OCs, offense-HCs).
   * Null for everyone else. */
  offensiveArchetype: string | null;
  /** Coach-only. Archetype name like `fangio_two_high`. Populated for
   * coaches who carry a defensive scheme identity (DCs, defense-HCs).
   * Null for everyone else. */
  defensiveArchetype: string | null;
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
