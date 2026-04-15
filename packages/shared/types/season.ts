export type SeasonPhase =
  | "preseason"
  | "regular_season"
  | "playoffs"
  | "offseason";

export type OffseasonStage =
  | "awards_and_review"
  | "coaching_carousel"
  | "combine"
  | "free_agency"
  | "draft"
  | "udfa_signing"
  | "minicamp";

export interface Season {
  id: string;
  leagueId: string;
  year: number;
  phase: SeasonPhase;
  offseasonStage: OffseasonStage | null;
  week: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewSeason {
  leagueId: string;
  year?: number;
  phase?: SeasonPhase;
  offseasonStage?: OffseasonStage | null;
  week?: number;
}
