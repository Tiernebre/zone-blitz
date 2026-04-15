import type {
  Franchise,
  League,
  LeagueFoundResult,
  LeagueListItem,
  NewLeague,
  Team,
} from "@zone-blitz/shared";

export interface CreateLeagueResult {
  league: League;
  franchises: Franchise[];
}

export interface LeagueService {
  getAll(): Promise<LeagueListItem[]>;
  getById(id: string): Promise<League>;
  create(input: NewLeague): Promise<CreateLeagueResult>;
  found(leagueId: string): Promise<LeagueFoundResult>;
  getFranchiseTeams(leagueId: string): Promise<Team[]>;
  assignUserTeam(id: string, userTeamId: string): Promise<League>;
  touchLastPlayed(id: string): Promise<League>;
  deleteById(id: string): Promise<void>;
}
