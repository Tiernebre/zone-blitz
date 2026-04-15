import type { Actor, AdvanceResult } from "./league-clock.types.ts";

export interface LeagueClockService {
  advance(leagueId: string, actor: Actor): Promise<AdvanceResult>;
}
