// Types
export type { HealthStatus } from "./types/health.ts";
export type { League, NewLeague } from "./types/league.ts";
export type { Team } from "./types/team.ts";
export type { NewSeason, Season, SeasonPhase } from "./types/season.ts";
export type {
  Coach,
  Contract,
  DraftProspect,
  FrontOfficeStaff,
  Player,
  Scout,
} from "./types/personnel.ts";
export type { Game } from "./types/game.ts";

// Interfaces — generators
export type {
  ContractGeneratorInput,
  GeneratedContract,
  GeneratedPersonnel,
  PersonnelGenerator,
  PersonnelGeneratorInput,
} from "./interfaces/generators/personnel-generator.ts";
export type {
  GeneratedGame,
  ScheduleGenerator,
  ScheduleGeneratorInput,
  TeamDivisionInfo,
} from "./interfaces/generators/schedule-generator.ts";

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

// Errors
export { DomainError } from "./errors/domain-error.ts";
