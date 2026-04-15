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

export { simulateGame } from "./simulate-game.ts";
export { simulateSeason } from "./simulate-season.ts";
export type { SeasonInput, SeasonResult } from "./simulate-season.ts";
export {
  computeGameAggregates,
  computeSeasonAggregates,
} from "./season-aggregates.ts";
export type { GameAggregates, SeasonAggregates } from "./season-aggregates.ts";
export { seedSweep } from "./seed-sweep.ts";
export type { BandStats, SweepResult } from "./seed-sweep.ts";
