import type { NeutralBucket } from "../../archetypes/neutral-bucket.ts";

export interface GMStrategy {
  evaluateTrade(offer: TradeOffer): TradeDecision;
  selectDraftPick(
    available: DraftCandidate[],
    needs: TeamNeeds,
  ): DraftSelection;
}

export interface TradeOffer {
  offeredPlayerIds: string[];
  requestedPlayerIds: string[];
  offeredPickIds: string[];
  requestedPickIds: string[];
}

export interface TradeDecision {
  accept: boolean;
  reasoning: string;
}

export interface DraftCandidate {
  playerId: string;
  neutralBucket: NeutralBucket;
  rating: number;
}

export interface TeamNeeds {
  buckets: NeutralBucket[];
  strategy: "win-now" | "rebuild";
}

export interface DraftSelection {
  playerId: string;
  reasoning: string;
}
