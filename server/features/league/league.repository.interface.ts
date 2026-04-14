import type { League, NewLeague } from "@zone-blitz/shared";
import type { Executor } from "../../db/connection.ts";

export interface LeagueRepository {
  getAll(): Promise<League[]>;
  getById(id: string): Promise<League | undefined>;
  create(league: NewLeague, tx?: Executor): Promise<League>;
  updateUserTeam(id: string, userTeamId: string): Promise<League | undefined>;
  touchLastPlayed(id: string): Promise<League | undefined>;
  deleteById(id: string): Promise<void>;
}
