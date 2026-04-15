export type {
  BoxScore,
  DefensiveCall,
  DriveResult,
  DriveSummary,
  GameResult,
  InjuryEntry,
  InjurySeverity,
  OffensiveCall,
  PlayEvent,
  PlayOutcome,
  PlayParticipant,
  PlayTag,
  TeamBoxScore,
} from "./events.ts";

export {
  createRng,
  createSeededRng,
  deriveGameSeed,
  mulberry32,
} from "./rng.ts";
export type { SeededRng } from "./rng.ts";

export { resolvePlay } from "./resolve-play.ts";
export { simulateGame } from "./simulate-game.ts";
export type { SimTeam, SimulationInput } from "./simulate-game.ts";
export {
  drawDefensiveCall,
  drawOffensiveCall,
  identifyMatchups,
  rollMatchup,
  synthesizeOutcome,
} from "./resolve-play.ts";
export type {
  CoachingMods,
  GameState,
  Matchup,
  MatchupContribution,
  MatchupType,
  PlayerRuntime,
  Situation,
  TeamRuntime,
} from "./resolve-play.ts";
