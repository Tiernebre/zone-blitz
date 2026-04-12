import type { League, NewLeague } from "../../types/league.ts";

export interface LeagueService {
  getAll(): Promise<League[]>;
  getById(id: string): Promise<League>;
  create(input: NewLeague): Promise<League>;
}
