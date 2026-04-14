import { useQuery } from "@tanstack/react-query";
import { api } from "../api.ts";

export function useRosterFit(leagueId: string, teamId: string | null) {
  const safeTeamId = teamId ?? "";
  return useQuery({
    queryKey: ["roster", "fit", leagueId, safeTeamId],
    queryFn: async () => {
      const res = await api.api.roster.leagues[":leagueId"].teams[":teamId"]
        .fit.$get({
          param: { leagueId, teamId: safeTeamId },
        });
      return res.json();
    },
    enabled: leagueId.length > 0 && safeTeamId.length > 0,
  });
}
