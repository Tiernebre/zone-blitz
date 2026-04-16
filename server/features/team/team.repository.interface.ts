import type { Team } from "@zone-blitz/shared";
import type { Executor } from "../../db/connection.ts";

export interface NewTeamInput {
  leagueId: string;
  franchiseId: string;
  name: string;
  cityId: string;
  abbreviation: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backstory: string;
  conference: string;
  division: string;
}

export interface TeamRepository {
  createMany(rows: NewTeamInput[], tx?: Executor): Promise<Team[]>;
  getByLeagueId(leagueId: string, tx?: Executor): Promise<Team[]>;
  getById(id: string, tx?: Executor): Promise<Team | undefined>;
}
