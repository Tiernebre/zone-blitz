export interface Blocker {
  teamId: string;
  reason: string;
}

export type GateResult = { ok: true } | { ok: false; blockers: Blocker[] };

export interface TeamClockState {
  teamId: string;
  isHuman: boolean;
  rosterCount: number;
  totalCap: number;
}

export interface LeagueClockState {
  leagueId: string;
  salaryCap: number;
  rosterSize: number;
  teams: TeamClockState[];
  currentPhase: string;
  currentStepIndex: number;
  draftOrderResolved: boolean;
  superBowlPlayed: boolean;
}

export type GateFunction = (state: LeagueClockState) => GateResult;

export interface Actor {
  userId: string;
  isCommissioner: boolean;
  forceAdvance?: boolean;
  overrideReason?: string;
}

export interface AdvanceResult {
  leagueId: string;
  seasonYear: number;
  phase: string;
  stepIndex: number;
  advancedAt: Date;
  advancedByUserId: string;
  overrideReason: string | null;
  overrideBlockers: Blocker[] | null;
}
