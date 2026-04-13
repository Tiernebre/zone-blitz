// Types
export type { HealthStatus } from "./types/health.ts";
export type { League, NewLeague } from "./types/league.ts";
export type { Team } from "./types/team.ts";

// Interfaces — repositories
export type { LeagueRepository } from "./interfaces/repositories/league-repository.ts";
export type { TeamRepository } from "./interfaces/repositories/team-repository.ts";
export type { UserRepository } from "./interfaces/repositories/user-repository.ts";

// Interfaces — services
export type { HealthService } from "./interfaces/services/health-service.ts";
export type { LeagueService } from "./interfaces/services/league-service.ts";
export type { UserService } from "./interfaces/services/user-service.ts";

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
