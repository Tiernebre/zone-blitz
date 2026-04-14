import { useQuery } from "@tanstack/react-query";
import { api } from "../api.ts";

export function useSchemeFingerprint(leagueId: string, teamId: string) {
  return useQuery({
    queryKey: ["coaches", "fingerprint", leagueId, teamId],
    queryFn: async () => {
      const res = await api.api.coaches.leagues[":leagueId"].teams[":teamId"]
        .fingerprint.$get({
          param: { leagueId, teamId },
        });
      return res.json();
    },
    enabled: leagueId.length > 0 && teamId.length > 0,
  });
}
