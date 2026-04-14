import type {
  DraftCandidate,
  DraftSelection,
  GMStrategy,
  TeamNeeds,
  TradeDecision,
  TradeOffer,
} from "@zone-blitz/shared";

export function createGMStrategy(): GMStrategy {
  return {
    evaluateTrade(offer: TradeOffer): TradeDecision {
      // Placeholder — real AI logic will replace this
      const netValue = offer.offeredPlayerIds.length -
        offer.requestedPlayerIds.length;
      return {
        accept: netValue >= 0,
        reasoning: netValue >= 0
          ? "Trade looks favorable"
          : "Giving up too much",
      };
    },

    selectDraftPick(
      available: DraftCandidate[],
      needs: TeamNeeds,
    ): DraftSelection {
      // Placeholder — pick the highest-rated player at a need bucket
      const needPick = available
        .filter((p) => needs.buckets.includes(p.neutralBucket))
        .sort((a, b) => b.rating - a.rating)[0];

      const pick = needPick ?? available.sort((a, b) => b.rating - a.rating)[0];

      return {
        playerId: pick.playerId,
        reasoning: needPick
          ? `Filling need at ${pick.neutralBucket}`
          : `Best player available: ${pick.neutralBucket}`,
      };
    },
  };
}
