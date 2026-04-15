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
  | "missed_field_goal"
  | "punt"
  | "penalty"
  | "kneel"
  | "spike"
  | "kickoff"
  | "xp"
  | "two_point"
  | "safety";

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
  | "accepted_penalty"
  | "declined_penalty"
  | "negated_play"
  | "touchdown"
  | "safety"
  | "two_point_conversion"
  | "sack"
  | "pressure"
  | "interception"
  | "fumble"
  | "fumble_recovery"
  | "muff"
  | "blocked_kick"
  | "injury_shake_off"
  | "injury_miss_drive"
  | "injury_miss_quarter"
  | "injury_miss_game"
  | "injury_miss_weeks"
  | "injury_miss_season"
  | "injury_career_ending"
  | "onside"
  | "missed_fg"
  | "fourth_down_attempt"
  | "return_td"
  | "two_minute"
  | "victory_formation"
  | "timeout";

export type PenaltyType =
  | "false_start"
  | "offsides"
  | "delay_of_game"
  | "holding"
  | "defensive_holding"
  | "pass_interference"
  | "defensive_pass_interference"
  | "facemask"
  | "roughing_the_passer"
  | "illegal_block_in_the_back"
  | "illegal_use_of_hands"
  | "unnecessary_roughness"
  | "encroachment"
  | "neutral_zone_infraction"
  | "illegal_contact";

export type PenaltyPhase = "pre_snap" | "post_snap";

export type PenaltyInfo = {
  type: PenaltyType;
  phase: PenaltyPhase;
  yardage: number;
  automaticFirstDown: boolean;
  againstTeamId: string;
  againstPlayerId: string | null;
  accepted: boolean;
};

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
  penalty?: PenaltyInfo;
};

export type DriveResult =
  | "touchdown"
  | "field_goal"
  | "missed_field_goal"
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
