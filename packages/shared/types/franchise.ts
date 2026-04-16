import type { MarketTier } from "./market-tier.ts";

export interface Franchise {
  id: string;
  name: string;
  cityId: string;
  city: string;
  state: string;
  abbreviation: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backstory: string;
  conference: string;
  division: string;
  marketTier: MarketTier;
  createdAt: Date;
  updatedAt: Date;
}
