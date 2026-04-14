import { useQuery } from "@tanstack/react-query";
import { api } from "../api.ts";

export function usePlayerDetail(playerId: string | null) {
  return useQuery({
    queryKey: ["player-detail", playerId],
    enabled: Boolean(playerId),
    queryFn: async () => {
      const res = await api.api.players[":playerId"].$get({
        param: { playerId: playerId! },
      });
      return res.json();
    },
  });
}
