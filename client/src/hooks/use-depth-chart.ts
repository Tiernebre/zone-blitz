import { useQuery } from "@tanstack/react-query";
import { api } from "../api.ts";

export function useDepthChart(leagueId: string, teamId: string | null) {
  return useQuery({
    queryKey: ["roster", "depth-chart", leagueId, teamId],
    enabled: Boolean(leagueId) && Boolean(teamId),
    queryFn: async () => {
      const res = await api.api.roster.leagues[":leagueId"].teams[":teamId"][
        "depth-chart"
      ].$get({ param: { leagueId, teamId: teamId! } });
      return res.json();
    },
  });
}
