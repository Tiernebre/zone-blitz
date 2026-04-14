// Types
export type { HealthStatus } from "./types/health.ts";
export type {
  League,
  LeagueListItem,
  LeagueSeasonSummary,
  NewLeague,
} from "./types/league.ts";
export type { Team } from "./types/team.ts";
export type { NewSeason, Season, SeasonPhase } from "./types/season.ts";
export type { FrontOfficeStaff } from "./types/front-office.ts";
export type {
  Coach,
  CoachPlayCaller,
  CoachRole,
  CoachSpecialty,
} from "./types/coach.ts";
export type { Scout } from "./types/scout.ts";
export type { Contract, DraftProspect, Player } from "./types/player.ts";
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
export { createLeagueSchema } from "./schemas/league.ts";
export {
  attributeRatingSchema,
  playerAttributesSchema,
} from "./schemas/player-attributes.ts";

// Errors
export { DomainError } from "./errors/domain-error.ts";
