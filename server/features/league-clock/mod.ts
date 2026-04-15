export { createLeagueClockRepository } from "./league-clock.repository.ts";
export type { LeagueClockRepository } from "./league-clock.repository.ts";
export { createLeagueClockService } from "./league-clock.service.ts";
export type {
  Actor,
  AdvanceResult,
  LeagueClockService,
} from "./league-clock.service.ts";
export type {
  Blocker,
  GateFn,
  GateResult,
  LeagueGateState,
  TeamGateState,
} from "./gates.ts";
export {
  computeNextStep,
  getGateForPhase,
  resolveAutoBlockers,
} from "./gates.ts";
