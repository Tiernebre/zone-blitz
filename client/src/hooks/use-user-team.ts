import { useLeague } from "./use-league.ts";
import { useLeagueTeams } from "./use-teams.ts";

export interface UserTeam {
  id: string;
  name: string;
  city: string;
  abbreviation: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

export function useUserTeam(leagueId: string): UserTeam | undefined {
  const { data: league } = useLeague(leagueId);
  const { data: teams } = useLeagueTeams(leagueId);
  const userTeamId = league?.userTeamId;
  if (!userTeamId || !teams) return undefined;
  return (teams as UserTeam[]).find((team) => team.id === userTeamId);
}
