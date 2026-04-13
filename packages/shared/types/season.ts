export type SeasonPhase =
  | "preseason"
  | "regular_season"
  | "playoffs"
  | "offseason";

export interface Season {
  id: string;
  leagueId: string;
  year: number;
  phase: SeasonPhase;
  week: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewSeason {
  leagueId: string;
  year?: number;
  phase?: SeasonPhase;
  week?: number;
}
