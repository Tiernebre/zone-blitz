export type {
  BoxScore,
  DefensiveCall,
  DriveResult,
  DriveSummary,
  GameResult,
  InjuryEntry,
  InjurySeverity,
  OffensiveCall,
  PenaltyInfo,
  PenaltyPhase,
  PenaltyType,
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
export { resolveKickoff } from "./resolve-kickoff.ts";
export type { KickoffContext, KickoffResult } from "./resolve-kickoff.ts";
export {
  deriveBoxScore,
  deriveDriveLog,
  deriveInjuryReport,
} from "./derive-game-views.ts";
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

export { resolvePunt } from "./resolve-punt.ts";
export type { PuntInput, PuntOutcome, PuntResult } from "./resolve-punt.ts";

export { resolveFieldGoal } from "./resolve-field-goal.ts";
export type {
  FieldGoalInput,
  FieldGoalOutcome,
  FieldGoalResult,
} from "./resolve-field-goal.ts";

export { simulateSeason } from "./simulate-season.ts";
export type { SeasonInput, SeasonResult } from "./simulate-season.ts";

export { computeSeasonAggregates } from "./season-aggregates.ts";
export type { SeasonAggregates } from "./season-aggregates.ts";

export {
  conversionDecision,
  detectSafety,
  findKicker,
  findTurnoverDefender,
  resolveExtraPoint,
  resolveReturnTd,
  resolveTwoPointConversion,
} from "./scoring.ts";
export type { ConversionChoice } from "./scoring.ts";

export { seedSweep } from "./seed-sweep.ts";
export type { BandStats, SweepResult } from "./seed-sweep.ts";

export {
  decidePenaltyAcceptance,
  PENALTY_CATALOG,
  pickPenalty,
  shouldPenaltyOccur,
} from "./resolve-penalty.ts";
export type {
  AcceptanceContext,
  PenaltyCandidate,
  PenaltyContext,
} from "./resolve-penalty.ts";
