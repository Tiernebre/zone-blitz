import type {
  League,
  LeagueGenerateResult,
  LeagueListItem,
  NewLeague,
  Team,
} from "@zone-blitz/shared";

export interface CreateLeagueResult {
  league: League;
  teams: Team[];
}

export interface LeagueService {
  getAll(): Promise<LeagueListItem[]>;
  getById(id: string): Promise<League>;
  create(input: NewLeague): Promise<CreateLeagueResult>;
  generate(leagueId: string): Promise<LeagueGenerateResult>;
  getTeams(leagueId: string): Promise<Team[]>;
  assignUserTeam(id: string, userTeamId: string): Promise<League>;
  touchLastPlayed(id: string): Promise<League>;
  deleteById(id: string): Promise<void>;
}
