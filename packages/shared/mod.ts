// Types
export type { HealthStatus } from "./types/health.ts";
export type {
  AdvancePolicy,
  League,
  LeagueListItem,
  LeagueSeasonSummary,
  LeagueUserTeamSummary,
  NewLeague,
} from "./types/league.ts";
export type { Team } from "./types/team.ts";
export type {
  NewSeason,
  OffseasonStage,
  Season,
  SeasonPhase,
} from "./types/season.ts";
export type { FrontOfficeStaff } from "./types/front-office.ts";
export type {
  Coach,
  CoachAccolade,
  CoachCareerStop,
  CoachCollege,
  CoachConnection,
  CoachDepthChartNote,
  CoachDetail,
  CoachNode,
  CoachPlayCaller,
  CoachRole,
  CoachSpecialty,
  CoachSummary,
  CoachTenurePlayerDev,
  CoachTenureUnitSeason,
} from "./types/coach.ts";
export type {
  CoachTendencies,
  CoachTendenciesUpsertInput,
  DefensiveTendencies,
  OffensiveTendencies,
} from "./types/coach-tendencies.ts";
export {
  DEFENSIVE_TENDENCY_KEYS,
  OFFENSIVE_TENDENCY_KEYS,
} from "./types/coach-tendencies.ts";
export type {
  SchemeFingerprint,
  SchemeFingerprintOverrides,
} from "./types/scheme-fingerprint.ts";
export type { SchemeFitLabel } from "./types/scheme-fit.ts";
export { SCHEME_FIT_LABELS } from "./types/scheme-fit.ts";
export type { SchemeArchetype, SchemeLensResult } from "./types/scheme-lens.ts";
export {
  DEFENSIVE_BUCKETS,
  OFFENSIVE_BUCKETS,
  SCHEME_ARCHETYPES,
  SPECIALIST_BUCKETS,
} from "./types/scheme-lens.ts";
export type {
  Scout,
  ScoutCareerStop,
  ScoutConnection,
  ScoutConnectionRelation,
  ScoutCrossCheck,
  ScoutCrossCheckWinner,
  ScoutDetail,
  ScoutEvaluation,
  ScoutEvaluationLevel,
  ScoutEvaluationOutcome,
  ScoutExternalTrackRecord,
  ScoutNode,
  ScoutRole,
  ScoutRoundTier,
  ScoutSummary,
} from "./types/scout.ts";
export type {
  ActiveRoster,
  DepthChart,
  DepthChartInactive,
  DepthChartSlot,
  NeutralBucketGroup,
  RosterPlayer,
  RosterPositionGroupSummary,
  RosterStatistics,
  RosterStatisticsRow,
} from "./types/roster.ts";
export { NEUTRAL_BUCKET_GROUPS, neutralBucketGroupOf } from "./types/roster.ts";
export type {
  ContractLedgerEntry,
  ContractType,
  ContractYearInput,
  ContractYearRow,
} from "./contracts/contract-ledger.ts";
export {
  buildContractYears,
  CONTRACT_TYPES,
} from "./contracts/contract-ledger.ts";
export type {
  Contract,
  ContractHistoryEntry,
  ContractTerminationReason,
  CurrentContractSummary,
  DepthChartSlotCode,
  DraftEligiblePlayer,
  Player,
  PlayerAccoladeEntry,
  PlayerAccoladeType,
  PlayerDetail,
  PlayerInjuryStatus,
  PlayerOrigin,
  PlayerSeasonStatRow,
  PlayerStatus,
  PlayerTransactionEntry,
  PlayerTransactionType,
  PreDraftEvaluation,
} from "./types/player.ts";
export {
  CONTRACT_TERMINATION_REASONS,
  DEPTH_CHART_SLOT_CODES,
  PLAYER_ACCOLADE_TYPES,
  PLAYER_INJURY_STATUSES,
  PLAYER_STATUSES,
  PLAYER_TRANSACTION_TYPES,
} from "./types/player.ts";
export type {
  MentalAttributeKey,
  PersonalityAttributeKey,
  PhysicalAttributeKey,
  PlayerAttributeKey,
  PlayerAttributes,
  TechnicalAttributeKey,
} from "./types/player-attributes.ts";
export {
  MENTAL_ATTRIBUTE_KEYS,
  PERSONALITY_ATTRIBUTE_KEYS,
  PHYSICAL_ATTRIBUTE_KEYS,
  PLAYER_ATTRIBUTE_KEYS,
  TECHNICAL_ATTRIBUTE_KEYS,
} from "./types/player-attributes.ts";
export type {
  NeutralBucket,
  NeutralBucketInput,
} from "./archetypes/neutral-bucket.ts";
export { NEUTRAL_BUCKETS, neutralBucket } from "./archetypes/neutral-bucket.ts";
export type { Game } from "./types/game.ts";
export type {
  DepthChartSectionLabels,
  DepthChartSlotDefinition,
  DepthChartSlotGroup,
} from "./depth-chart/vocabulary.ts";
export {
  depthChartSectionLabels,
  depthChartVocabulary,
} from "./depth-chart/vocabulary.ts";
export { eligibleBucketsForSlot } from "./depth-chart/slot-mapping.ts";
export { assignDepthChart } from "./depth-chart/assign.ts";
export type {
  DepthChartAssignment,
  PlayerForAssignment,
} from "./depth-chart/assign.ts";

// Market
export type { PositionalMarketEntry } from "./market/positional-market-value.ts";
export {
  POSITIONAL_MARKET_VALUES,
  positionalSalaryMultiplier,
} from "./market/positional-market-value.ts";

// Interfaces — simulation
export type {
  GameEvent,
  GameResult,
  GameSimulator,
} from "./interfaces/simulation/game-simulator.ts";

// Interfaces — AI
export type {
  DraftCandidate,
  DraftSelection,
  GMStrategy,
  TeamNeeds,
  TradeDecision,
  TradeOffer,
} from "./interfaces/ai/gm-strategy.ts";

// Schemas
export {
  assignUserTeamSchema,
  castAdvanceVoteSchema,
  createLeagueSchema,
} from "./schemas/league.ts";
export {
  attributeRatingSchema,
  playerAttributesSchema,
} from "./schemas/player-attributes.ts";

// Statistics
export type { StatColumnDefinition } from "./statistics/position-stat-columns.ts";
export { statColumnsForBucket } from "./statistics/position-stat-columns.ts";
export type { CareerTotalsResult } from "./statistics/career-totals.ts";
export { computeCareerTotals } from "./statistics/career-totals.ts";

// RNG
export {
  createRng,
  createSeededRng,
  deriveGameSeed,
  mulberry32,
} from "./rng/mod.ts";
export type { SeededRng } from "./rng/mod.ts";

// League
export { deriveDefaultSeasonLength } from "./league/derive-default-season-length.ts";

// Errors
export { DomainError } from "./errors/domain-error.ts";
