import { useQuery } from "@tanstack/react-query";
import { api } from "../api.ts";

export function useScoutDetail(scoutId: string) {
  return useQuery({
    queryKey: ["scouts", "detail", scoutId],
    queryFn: async () => {
      const res = await api.api.scouts[":scoutId"].$get({
        param: { scoutId },
      });
      return res.json();
    },
    enabled: scoutId.length > 0,
  });
}
