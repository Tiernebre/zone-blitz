export interface GameSimulator {
  simulate(homeTeamId: string, awayTeamId: string): GameResult;
}

export interface GameResult {
  homeScore: number;
  awayScore: number;
  events: GameEvent[];
}

export interface GameEvent {
  quarter: number;
  timestamp: number;
  description: string;
}
