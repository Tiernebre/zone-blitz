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
  position: string;
  rating: number;
}

export interface TeamNeeds {
  positions: string[];
  strategy: "win-now" | "rebuild";
}

export interface DraftSelection {
  playerId: string;
  reasoning: string;
}
