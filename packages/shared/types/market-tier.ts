export const MARKET_TIERS = ["large", "medium", "small"] as const;

export type MarketTier = typeof MARKET_TIERS[number];
