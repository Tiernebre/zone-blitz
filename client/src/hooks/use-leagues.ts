import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api.ts";

export function useLeagues() {
  return useQuery({
    queryKey: ["leagues"],
    queryFn: async () => {
      const res = await api.api.leagues.$get();
      return res.json();
    },
  });
}

export function useCreateLeague() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string }) => {
      const res = await api.api.leagues.$post({ json: input });
      if (!res.ok) {
        throw new Error(`Failed to create league (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leagues"] });
    },
  });
}

export function useAssignUserTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      { leagueId, userTeamId }: { leagueId: string; userTeamId: string },
    ) => {
      const res = await api.api.leagues[":id"]["user-team"].$patch({
        param: { id: leagueId },
        json: { userTeamId },
      });
      if (!res.ok) {
        throw new Error(`Failed to assign team (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leagues"] });
    },
  });
}

export function useTouchLeague() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.api.leagues[":id"].touch.$post({
        param: { id },
      });
      if (!res.ok) {
        throw new Error(`Failed to touch league (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leagues"] });
    },
  });
}

export function useFoundLeague() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (leagueId: string) => {
      const res = await api.api.leagues[":id"].found.$post({
        param: { id: leagueId },
      });
      if (!res.ok) {
        throw new Error(`Failed to found league (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leagues"] });
    },
  });
}

export function useDeleteLeague() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.api.leagues[":id"].$delete({ param: { id } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leagues"] });
    },
  });
}
