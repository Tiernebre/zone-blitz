// Types
export type { HealthStatus } from "./types/health.ts";
export type {
  League,
  LeagueListItem,
  LeagueSeasonSummary,
  LeagueUserTeamSummary,
  NewLeague,
} from "./types/league.ts";
export type { Team } from "./types/team.ts";
export type { NewSeason, Season, SeasonPhase } from "./types/season.ts";
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
export type { Scout } from "./types/scout.ts";
export type {
  ActiveRoster,
  DepthChart,
  DepthChartInactive,
  DepthChartSlot,
  PlayerPositionGroup,
  RosterPlayer,
  RosterPositionGroupSummary,
  RosterStatistics,
  RosterStatisticsRow,
} from "./types/roster.ts";
export type {
  Contract,
  DraftProspect,
  Player,
  PlayerInjuryStatus,
  PlayerPosition,
} from "./types/player.ts";
export {
  PLAYER_INJURY_STATUSES,
  PLAYER_POSITION_GROUPS,
  PLAYER_POSITIONS,
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
export type { Game } from "./types/game.ts";

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
export { assignUserTeamSchema, createLeagueSchema } from "./schemas/league.ts";
export {
  attributeRatingSchema,
  playerAttributesSchema,
} from "./schemas/player-attributes.ts";

// Errors
export { DomainError } from "./errors/domain-error.ts";
