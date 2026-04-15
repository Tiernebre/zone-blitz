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
  | "spike"
  | "kickoff";

export type InjurySeverity =
  | "shake_off"
  | "miss_drive"
  | "miss_quarter"
  | "miss_game"
  | "miss_weeks"
  | "miss_season"
  | "career_ending";

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
  | "fumble_recovery"
  | "injury_shake_off"
  | "injury_miss_drive"
  | "injury_miss_quarter"
  | "injury_miss_game"
  | "injury_miss_weeks"
  | "injury_miss_season"
  | "injury_career_ending"
  | "onside";

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

export type DriveResult =
  | "touchdown"
  | "field_goal"
  | "punt"
  | "turnover"
  | "turnover_on_downs"
  | "end_of_half"
  | "safety";

export type DriveSummary = {
  driveIndex: number;
  offenseTeamId: string;
  startYardLine: number;
  plays: number;
  yards: number;
  result: DriveResult;
};

export type TeamBoxScore = {
  totalYards: number;
  passingYards: number;
  rushingYards: number;
  turnovers: number;
  sacks: number;
  penalties: number;
};

export type BoxScore = {
  home: TeamBoxScore;
  away: TeamBoxScore;
};

export type InjuryEntry = {
  playerId: string;
  playIndex: number;
  driveIndex: number;
  quarter: 1 | 2 | 3 | 4 | "OT";
  severity: InjurySeverity;
};

export type GameResult = {
  gameId: string;
  seed: number;
  finalScore: { home: number; away: number };
  events: PlayEvent[];
  boxScore: BoxScore;
  driveLog: DriveSummary[];
  injuryReport: InjuryEntry[];
};
