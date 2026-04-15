export type OffensiveCall = {
  concept: string;
  personnel: string;
  formation: string;
  motion: string;
};

export type DefensiveCall = {
  front: string;
  coverage: string;
  pressure: string;
};

export type PlayParticipant = {
  role: string;
  playerId: string;
  tags: string[];
};

export type PlayOutcome =
  | "rush"
  | "pass_complete"
  | "pass_incomplete"
  | "sack"
  | "interception"
  | "fumble"
  | "touchdown"
  | "field_goal"
  | "punt"
  | "penalty"
  | "kneel"
  | "spike";

export type PlayTag =
  | "first_down"
  | "turnover"
  | "big_play"
  | "injury"
  | "penalty"
  | "touchdown"
  | "safety"
  | "two_point_conversion"
  | "sack"
  | "pressure"
  | "interception"
  | "fumble"
  | "fumble_recovery";

export type PlayEvent = {
  gameId: string;
  driveIndex: number;
  playIndex: number;
  quarter: 1 | 2 | 3 | 4 | "OT";
  clock: string;
  situation: { down: 1 | 2 | 3 | 4; distance: number; yardLine: number };
  offenseTeamId: string;
  defenseTeamId: string;
  call: OffensiveCall;
  coverage: DefensiveCall;
  participants: PlayParticipant[];
  outcome: PlayOutcome;
  yardage: number;
  tags: PlayTag[];
};

export type BoxScore = Record<string, unknown>;

export type DriveSummary = Record<string, unknown>;

export type InjuryEntry = Record<string, unknown>;

export type GameResult = {
  gameId: string;
  seed: number;
  finalScore: { home: number; away: number };
  events: PlayEvent[];
  boxScore: BoxScore;
  driveLog: DriveSummary[];
  injuryReport: InjuryEntry[];
};
