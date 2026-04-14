import { useQuery } from "@tanstack/react-query";
import { api } from "../api.ts";

export function useScoutStaffTree(leagueId: string, teamId: string) {
  return useQuery({
    queryKey: ["scouts", "staff-tree", leagueId, teamId],
    queryFn: async () => {
      const res = await api.api.scouts.leagues[":leagueId"].teams[":teamId"]
        .staff.$get({
          param: { leagueId, teamId },
        });
      return res.json();
    },
    enabled: leagueId.length > 0 && teamId.length > 0,
  });
}
