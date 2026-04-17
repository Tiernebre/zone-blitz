import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const healthChecks = pgTable("health_checks", {
  id: serial("id").primaryKey(),
  status: text("status").notNull(),
  checkedAt: timestamp("checked_at").defaultNow().notNull(),
});

// Feature schemas
export {
  advancePolicyEnum,
  leagues,
} from "../features/league/league.schema.ts";
export { states } from "../features/states/state.schema.ts";
export { cities } from "../features/cities/city.schema.ts";
export { teams } from "../features/team/team.schema.ts";
export { colleges } from "../features/colleges/college.schema.ts";
export {
  offseasonStageEnum,
  seasonPhaseEnum,
  seasons,
} from "../features/season/season.schema.ts";
export { frontOfficeStaff } from "../features/front-office/front-office.schema.ts";
export {
  coaches,
  coachPlayCallerEnum,
  coachRoleEnum,
  coachSpecialtyEnum,
} from "../features/coaches/coach.schema.ts";
export { coachTendencies } from "../features/coaches/coach-tendencies.schema.ts";
export { coachRatings } from "../features/coaches/coach-ratings.schema.ts";
export {
  accoladeTypeEnum,
  coachAccolades,
  coachCareerStops,
  coachConnections,
  coachDepthChartNotes,
  coachReputationLabels,
  coachTenurePlayerDev,
  coachTenureUnitPerformance,
  connectionRelationEnum,
  playerDevDeltaEnum,
  tenureUnitSideEnum,
} from "../features/coaches/coach-history.schema.ts";
export { scoutRoleEnum, scouts } from "../features/scouts/scout.schema.ts";
export {
  scoutCareerStops,
  scoutConnectionRelationEnum,
  scoutConnections,
  scoutCrossChecks,
  scoutCrossCheckWinnerEnum,
  scoutEvaluationLevelEnum,
  scoutEvaluationOutcomeEnum,
  scoutEvaluations,
  scoutExternalTrackRecord,
  scoutReputationLabels,
  scoutRoundTierEnum,
} from "../features/scouts/scout-history.schema.ts";
export {
  playerInjuryStatusEnum,
  players,
  playerStatusEnum,
} from "../features/players/player.schema.ts";
export { depthChartEntries } from "../features/depth-chart/depth-chart.schema.ts";
export { playerAttributes } from "../features/players/attributes.schema.ts";
export { playerDraftProfile } from "../features/players/player-draft-profile.schema.ts";
export { playerSeasonRatings } from "../features/players/player-season-ratings.schema.ts";
export {
  contractBonusProrations,
  contractBonusSourceEnum,
  contractGuaranteeTypeEnum,
  contractOptionBonuses,
  contracts,
  contractTagTypeEnum,
  contractTypeEnum,
  contractYears,
} from "../features/contracts/contract.schema.ts";
export {
  contractHistory,
  contractTerminationReasonEnum,
} from "../features/contracts/contract-history.schema.ts";
export {
  playerTransactions,
  playerTransactionTypeEnum,
} from "../features/contracts/player-transaction.schema.ts";
export { playerSeasonStats } from "../features/players/player-career-log.schema.ts";
export {
  playerAccolades,
  playerAccoladeTypeEnum,
} from "../features/players/player-accolades.schema.ts";
export { games } from "../features/schedule/game.schema.ts";
export {
  accounts,
  sessions,
  users,
  verifications,
} from "../features/auth/auth.schema.ts";
export {
  leagueAdvanceVote,
  leagueClock,
  leaguePhaseEnum,
  leaguePhaseStep,
  stepKindEnum,
} from "../features/league-clock/league-clock.schema.ts";
export {
  franchises,
  marketTierEnum,
} from "../features/franchise/franchise.schema.ts";
export {
  hiringDecisions,
  hiringInterests,
  hiringInterestStatusEnum,
  hiringInterviews,
  hiringInterviewStatusEnum,
  hiringOffers,
  hiringOfferStatusEnum,
  staffTypeEnum,
} from "../features/hiring/hiring.schema.ts";
