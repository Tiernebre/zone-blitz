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

export { createRng, deriveGameSeed, mulberry32 } from "./rng.ts";
export type { SeededRng } from "./rng.ts";

export {
  drawDefensiveCall,
  drawOffensiveCall,
  identifyMatchups,
  resolvePlay,
  rollMatchup,
  synthesizeOutcome,
} from "./resolve-play.ts";
export type {
  CoachingMods,
  GameState,
  Matchup,
  MatchupContribution,
  MatchupType,
  OnFieldPlayer,
  RollMatchupInput,
  Situation,
  TeamRuntime,
} from "./resolve-play.ts";
