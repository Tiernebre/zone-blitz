import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  HiringCandidateDetail,
  HiringCandidateSummary,
  HiringOfferInput,
} from "@zone-blitz/shared";
import { api } from "../api.ts";

export function useHiringCandidates(
  leagueId: string,
  filter?: { role?: string; staffType?: "coach" | "scout" },
) {
  return useQuery({
    queryKey: ["hiring", leagueId, "candidates", filter ?? {}],
    queryFn: async () => {
      const res = await api.api.leagues[":leagueId"].hiring.candidates.$get({
        param: { leagueId },
        query: {
          role: filter?.role,
          staffType: filter?.staffType,
        },
      });
      return (await res.json()) as HiringCandidateSummary[];
    },
    enabled: !!leagueId,
  });
}

export function useHiringCandidateDetail(
  leagueId: string,
  candidateId: string,
) {
  return useQuery({
    queryKey: ["hiring", leagueId, "candidate", candidateId],
    queryFn: async () => {
      const res = await api.api.leagues[":leagueId"].hiring.candidates[
        ":candidateId"
      ].$get({
        param: { leagueId, candidateId },
      });
      if (res.status === 404) return null;
      return (await res.json()) as HiringCandidateDetail;
    },
    enabled: !!leagueId && !!candidateId,
  });
}

export function useTeamHiringState(leagueId: string) {
  return useQuery({
    queryKey: ["hiring", leagueId, "state"],
    queryFn: async () => {
      const res = await api.api.leagues[":leagueId"].hiring.state.$get({
        param: { leagueId },
      });
      if (!res.ok) {
        throw new Error(`Failed to load hiring state (${res.status})`);
      }
      return res.json();
    },
    enabled: !!leagueId,
  });
}

export function useHiringBlockers(leagueId: string) {
  return useQuery({
    queryKey: ["hiring", leagueId, "blockers"],
    queryFn: async () => {
      const res = await api.api.leagues[":leagueId"].hiring.blockers.$get({
        param: { leagueId },
      });
      if (!res.ok) {
        throw new Error(`Failed to load blockers (${res.status})`);
      }
      return (await res.json()) as {
        missingCoachRoles: string[];
        missingScoutRoles: string[];
      };
    },
    enabled: !!leagueId,
  });
}

function invalidateHiring(
  queryClient: ReturnType<typeof useQueryClient>,
  leagueId: string,
) {
  queryClient.invalidateQueries({ queryKey: ["hiring", leagueId] });
}

export function useExpressInterest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      { leagueId, candidateIds }: {
        leagueId: string;
        candidateIds: string[];
      },
    ) => {
      const res = await api.api.leagues[":leagueId"].hiring.interests.$post({
        param: { leagueId },
        json: { candidateIds },
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(
          (body as Record<string, string>).message ??
            `Failed to express interest (${res.status})`,
        );
      }
      return res.json();
    },
    onSuccess: (_data, variables) =>
      invalidateHiring(queryClient, variables.leagueId),
  });
}

export function useRequestInterviews() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      { leagueId, candidateIds }: {
        leagueId: string;
        candidateIds: string[];
      },
    ) => {
      const res = await api.api.leagues[":leagueId"].hiring.interviews.$post({
        param: { leagueId },
        json: { candidateIds },
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(
          (body as Record<string, string>).message ??
            `Failed to request interviews (${res.status})`,
        );
      }
      return res.json();
    },
    onSuccess: (_data, variables) =>
      invalidateHiring(queryClient, variables.leagueId),
  });
}

export function useSubmitOffers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      { leagueId, offers }: {
        leagueId: string;
        offers: HiringOfferInput[];
      },
    ) => {
      const res = await api.api.leagues[":leagueId"].hiring.offers.$post({
        param: { leagueId },
        json: { offers },
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(
          (body as Record<string, string>).message ??
            `Failed to submit offers (${res.status})`,
        );
      }
      return res.json();
    },
    onSuccess: (_data, variables) =>
      invalidateHiring(queryClient, variables.leagueId),
  });
}

export function useResolveBlocker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      { leagueId, candidateId }: {
        leagueId: string;
        candidateId: string;
      },
    ) => {
      const res = await api.api.leagues[":leagueId"].hiring.blockers.resolve
        .$post({
          param: { leagueId },
          json: { candidateId },
        });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(
          (body as Record<string, string>).message ??
            `Failed to resolve blocker (${res.status})`,
        );
      }
      return res.json();
    },
    onSuccess: (_data, variables) =>
      invalidateHiring(queryClient, variables.leagueId),
  });
}
