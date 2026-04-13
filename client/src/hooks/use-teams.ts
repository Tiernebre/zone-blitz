import { useQuery } from "@tanstack/react-query";
import { api } from "../api.ts";

export function useTeams() {
  return useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const res = await api.api.teams.$get();
      return res.json();
    },
  });
}
