import type { League, NewLeague } from "../../types/league.ts";

export interface LeagueRepository {
  getAll(): Promise<League[]>;
  getById(id: string): Promise<League | undefined>;
  create(league: NewLeague): Promise<League>;
  deleteById(id: string): Promise<void>;
}
