import type { League, LeagueListItem, NewLeague } from "@zone-blitz/shared";
import type { Executor } from "../../db/connection.ts";

export interface LeagueRepository {
  // Returns every league with its latest season + user-team summaries
  // pre-joined. The league-list page needs this shape; having the repo
  // own the joins keeps the service thin and collapses what used to be
  // a 1+2N query fan-out into two bounded queries.
  listWithSummary(): Promise<LeagueListItem[]>;
  getById(id: string): Promise<League | undefined>;
  create(league: NewLeague, tx?: Executor): Promise<League>;
  updateUserTeam(id: string, userTeamId: string): Promise<League | undefined>;
  touchLastPlayed(id: string): Promise<League | undefined>;
  deleteById(id: string): Promise<void>;
}
