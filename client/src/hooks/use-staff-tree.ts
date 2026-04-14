import { useQuery } from "@tanstack/react-query";
import { api } from "../api.ts";

export function useStaffTree(teamId: string) {
  return useQuery({
    queryKey: ["coaches", "staff-tree", teamId],
    queryFn: async () => {
      const res = await api.api.coaches.teams[":teamId"].staff.$get({
        param: { teamId },
      });
      return res.json();
    },
    enabled: teamId.length > 0,
  });
}
