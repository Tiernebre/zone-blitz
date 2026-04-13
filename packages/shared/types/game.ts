export interface Game {
  id: string;
  seasonId: string;
  week: number;
  homeTeamId: string;
  awayTeamId: string;
  createdAt: Date;
  updatedAt: Date;
}
