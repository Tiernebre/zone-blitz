import { useQuery } from "@tanstack/react-query";
import { api } from "../api.ts";

export function useActiveRoster(leagueId: string, teamId: string | null) {
  return useQuery({
    queryKey: ["roster", "active", leagueId, teamId],
    enabled: Boolean(leagueId) && Boolean(teamId),
    queryFn: async () => {
      const res = await api.api.roster.leagues[":leagueId"].teams[":teamId"]
        .active.$get({ param: { leagueId, teamId: teamId! } });
      return res.json();
    },
  });
}
