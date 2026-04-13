import { useQuery } from "@tanstack/react-query";
import { api } from "../api.ts";

export function useLeague(id: string) {
  return useQuery({
    queryKey: ["leagues", id],
    queryFn: async () => {
      const res = await api.api.leagues[":id"].$get({ param: { id } });
      return res.json();
    },
  });
}
