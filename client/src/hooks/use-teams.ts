import { useQuery } from "@tanstack/react-query";
import { api } from "../api.ts";

export function useLeagueTeams(leagueId: string) {
  return useQuery({
    queryKey: ["leagues", leagueId, "teams"],
    queryFn: async () => {
      const res = await api.api.teams.league[":leagueId"].$get({
        param: { leagueId },
      });
      return res.json();
    },
    enabled: !!leagueId,
  });
}
