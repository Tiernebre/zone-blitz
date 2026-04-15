import type { Executor } from "../../db/connection.ts";
import type { Blocker } from "./league-clock.types.ts";

export interface ClockRow {
  leagueId: string;
  seasonYear: number;
  phase: string;
  stepIndex: number;
  advancedAt: Date;
  advancedByUserId: string | null;
  overrideReason: string | null;
  overrideBlockers: Blocker[] | null;
}

export interface PhaseStepRow {
  phase: string;
  stepIndex: number;
  slug: string;
  kind: string;
}

export interface TeamRosterSummary {
  teamId: string;
  rosterCount: number;
  totalCap: number;
}

export interface LeagueClockRepository {
  getClock(leagueId: string): Promise<ClockRow | undefined>;

  getPhaseSteps(phase: string): Promise<PhaseStepRow[]>;

  getAllPhaseSteps(): Promise<PhaseStepRow[]>;

  writeClock(
    row: {
      leagueId: string;
      seasonYear: number;
      phase: string;
      stepIndex: number;
      advancedByUserId: string;
      overrideReason?: string | null;
      overrideBlockers?: Blocker[] | null;
    },
    tx?: Executor,
  ): Promise<ClockRow>;

  getTeamRosterSummaries(leagueId: string): Promise<TeamRosterSummary[]>;

  expireContracts(
    leagueId: string,
    seasonYear: number,
    tx?: Executor,
  ): Promise<void>;

  rollCapForward(
    leagueId: string,
    growthRate: number,
    tx?: Executor,
  ): Promise<void>;

  incrementSeasonYear(leagueId: string, tx?: Executor): Promise<void>;
}
