export type HiringStepView =
  | "market_survey"
  | "interview"
  | "offers"
  | "decisions"
  | "finalize"
  | "not_in_phase";

export function stepViewFor(slug: string): HiringStepView {
  if (slug === "hiring_market_survey") return "market_survey";
  if (
    slug === "hiring_interview_1" ||
    slug === "hiring_interview_2" ||
    slug === "hiring_second_wave_interview"
  ) return "interview";
  if (slug === "hiring_offers") return "offers";
  if (
    slug === "hiring_decisions" ||
    slug === "hiring_second_wave_decisions"
  ) return "decisions";
  if (slug === "hiring_finalization") return "finalize";
  return "not_in_phase";
}

export function stepHeadline(slug: string): string {
  switch (slug) {
    case "hiring_market_survey":
      return "Market Survey";
    case "hiring_interview_1":
      return "Interview Round 1";
    case "hiring_interview_2":
      return "Interview Round 2";
    case "hiring_offers":
      return "Offers";
    case "hiring_decisions":
      return "Decisions — Wave 1";
    case "hiring_second_wave_interview":
      return "Second-Wave Interviews";
    case "hiring_second_wave_decisions":
      return "Decisions — Wave 2";
    case "hiring_finalization":
      return "Finalization";
    default:
      return "Hiring";
  }
}

export function stepDescription(slug: string): string {
  switch (slug) {
    case "hiring_market_survey":
      return "Review the candidate pool and express interest in the staff you want to pursue.";
    case "hiring_interview_1":
    case "hiring_interview_2":
      return "Request interviews with candidates you're interested in. Not every candidate will agree.";
    case "hiring_offers":
      return "Extend contract offers to candidates who completed interviews.";
    case "hiring_decisions":
    case "hiring_second_wave_decisions":
      return "Candidates are weighing your offer against competing bids. Decisions are being made.";
    case "hiring_second_wave_interview":
      return "Chase anyone you missed in the first wave before the window closes.";
    case "hiring_finalization":
      return "Fill any remaining mandatory roles from the leftover candidate pool.";
    default:
      return "Hiring is active during the coaching carousel.";
  }
}
