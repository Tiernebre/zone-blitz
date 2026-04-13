import type { League, NewLeague } from "@zone-blitz/shared";

export interface LeagueService {
  getAll(): Promise<League[]>;
  getById(id: string): Promise<League>;
  create(input: NewLeague): Promise<League>;
  deleteById(id: string): Promise<void>;
}
