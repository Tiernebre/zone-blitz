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
  /** Current age, in years. Public knowledge. */
  age: number;
  /** Total career experience, in years. Independent of tenure with any
   * specific team — distinguishes the 25-year veteran from the rising
   * first-timer at a glance. */
  yearsExperience: number;
  /** Coach-only. Years this coach has served as a head coach. Zero for
   * first-time HC candidates regardless of overall career length — this
   * is what separates an unproven HC ask from a proven one. */
  headCoachYears: number;
  /** Coach-only. Years served as a coordinator (OC/DC/STC). */
  coordinatorYears: number;
  /** Coach-only. Years served as a position coach or assistant. */
  positionCoachYears: number;
  /** Coach-only. Position group the coach built their career on
   * (e.g. `QB`, `DL`, `GENERALIST`). Null for scouts. */
  positionBackground: string | null;
  /** Scout-only. Position group the scout's evaluation work focuses on
   * (e.g. `QB`, `GENERALIST`). Null for coaches. */
  positionFocus: string | null;
  /** Scout-only. Region this scout's network is strongest in
   * (`NORTHEAST`, `NATIONAL`, etc.). Null for coaches. */
  regionFocus: string | null;
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
