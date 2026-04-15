export type {
  BoxScore,
  DefensiveCall,
  DriveSummary,
  GameResult,
  InjuryEntry,
  OffensiveCall,
  PlayEvent,
  PlayOutcome,
  PlayParticipant,
  PlayTag,
} from "./events.ts";

export {
  createRng,
  createSeededRng,
  deriveGameSeed,
  mulberry32,
} from "./rng.ts";
export type { SeededRng } from "./rng.ts";

export { resolvePlay } from "./resolve-play.ts";
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
