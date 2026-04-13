import type { NewSeason, Season } from "../../types/season.ts";

export interface SeasonRepository {
  getByLeagueId(leagueId: string): Promise<Season[]>;
  getById(id: string): Promise<Season | undefined>;
  create(season: NewSeason): Promise<Season>;
}
