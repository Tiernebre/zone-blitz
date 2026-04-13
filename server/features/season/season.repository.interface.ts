import type { NewSeason, Season } from "@zone-blitz/shared";

export interface SeasonRepository {
  getByLeagueId(leagueId: string): Promise<Season[]>;
  getById(id: string): Promise<Season | undefined>;
  create(season: NewSeason): Promise<Season>;
}
