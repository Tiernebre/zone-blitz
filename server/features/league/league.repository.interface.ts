import type { League, NewLeague } from "@zone-blitz/shared";
import type { Executor } from "../../db/connection.ts";

export interface LeagueRepository {
  getAll(): Promise<League[]>;
  getById(id: string): Promise<League | undefined>;
  create(league: NewLeague, tx?: Executor): Promise<League>;
  deleteById(id: string): Promise<void>;
}
