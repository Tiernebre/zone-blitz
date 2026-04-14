import type { NewSeason, Season } from "@zone-blitz/shared";
import type { Executor } from "../../db/connection.ts";

export interface SeasonRepository {
  getByLeagueId(leagueId: string): Promise<Season[]>;
  getById(id: string): Promise<Season | undefined>;
  create(season: NewSeason, tx?: Executor): Promise<Season>;
}
