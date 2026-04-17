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
export type {
  ActiveRosters,
  SimTeam,
  SimulationInput,
} from "./simulate-game.ts";

export {
  formatClock,
  KNEEL_CLOCK_BURN,
  OT_SECONDS,
  QUARTER_SECONDS,
  SECONDS_PER_PLAY,
  shouldClockStop,
  shouldKneel,
  TIMEOUTS_PER_HALF,
  trySpendTimeout,
} from "./game-clock.ts";
export type { MutableGameState } from "./game-clock.ts";

export {
  advanceDowns,
  applyAcceptedPenalty,
  handleTurnover,
  startNewDrive,
  switchPossession,
} from "./possession.ts";

export {
  determineScoringOutcome,
  resolveConversion,
} from "./resolve-scoring.ts";
export type { ConversionContext, ScoringResult } from "./resolve-scoring.ts";
export {
  drawDefensiveCall,
  drawOffensiveCall,
  rollMatchup,
  synthesizeOutcome,
} from "./resolve-play.ts";
export {
  assignDefense,
  assignOffense,
  rankPlayers,
  resolveMatchups,
} from "./resolve-matchups.ts";
export type {
  DefensiveAssignment,
  DefensiveRole,
  OffensiveAssignment,
  OffensiveRole,
} from "./resolve-matchups.ts";
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

export { noopLogger } from "./simulation-logger.ts";
export type { SimLogger } from "./simulation-logger.ts";

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

export { resolveFourthDown } from "./resolve-fourth-down.ts";
export type {
  FourthDownDecision,
  FourthDownInput,
} from "./resolve-fourth-down.ts";

export {
  decidePenaltyAcceptance,
  PENALTY_CATALOG,
  PER_PLAY_PENALTY_RATE,
  pickPenalty,
  shouldPenaltyOccur,
} from "./resolve-penalty.ts";

export { coachRatingsToMods } from "./coach-mods-from-ratings.ts";
export type { CoachStaffRatings } from "./coach-mods-from-ratings.ts";
export type {
  AcceptanceContext,
  PenaltyCandidate,
  PenaltyContext,
} from "./resolve-penalty.ts";
