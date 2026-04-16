import type { Team } from "@zone-blitz/shared";
import type { Executor } from "../../db/connection.ts";
import type { NewTeamInput } from "./team.repository.interface.ts";

export interface TeamService {
  getByLeagueId(leagueId: string): Promise<Team[]>;
  getById(id: string): Promise<Team>;
  createMany(rows: NewTeamInput[], tx?: Executor): Promise<Team[]>;
}
