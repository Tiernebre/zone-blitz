import type { League, LeagueListItem, NewLeague } from "@zone-blitz/shared";

export interface LeagueService {
  getAll(): Promise<LeagueListItem[]>;
  getById(id: string): Promise<League>;
  create(input: NewLeague): Promise<League>;
  deleteById(id: string): Promise<void>;
}
