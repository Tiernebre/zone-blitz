import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api.ts";

export function useLeagueClock(leagueId: string) {
  return useQuery({
    queryKey: ["league-clock", leagueId],
    queryFn: async () => {
      const res = await api.api["league-clock"][":leagueId"].$get({
        param: { leagueId },
      });
      const data = await res.json();
      const { hasCompletedGenesis, ...rest } = data;
      return {
        ...rest,
        isInauguralSeason: !hasCompletedGenesis,
      };
    },
    enabled: !!leagueId,
  });
}

export function useAdvanceLeagueClock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      leagueId,
      isCommissioner,
      overrideReason,
      gateState,
    }: {
      leagueId: string;
      isCommissioner: boolean;
      overrideReason?: string;
      gateState: {
        teams: {
          teamId: string;
          isNpc: boolean;
          autoPilot: boolean;
          capCompliant: boolean;
          activeRosterCount: number;
          rosterLimit: number;
        }[];
        draftOrderResolved: boolean;
        superBowlPlayed: boolean;
        priorPhaseComplete: boolean;
        allTeamsHaveStaff: boolean;
      };
    }) => {
      const res = await api.api["league-clock"][":leagueId"].advance.$post({
        param: { leagueId },
        json: { isCommissioner, overrideReason, gateState },
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(
          (body as Record<string, string>).message ??
            `Advance failed (${res.status})`,
        );
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["league-clock", variables.leagueId],
      });
    },
  });
}
