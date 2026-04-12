// Types
export type { League, NewLeague } from "./types/league.ts";

// Interfaces — repositories
export type { LeagueRepository } from "./interfaces/repositories/league-repository.ts";

// Interfaces — services
export type { LeagueService } from "./interfaces/services/league-service.ts";

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
