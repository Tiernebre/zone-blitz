import type { MarketTier } from "@zone-blitz/shared";

export interface InitialFranchise {
  name: string;
  city: string;
  state: string;
  abbreviation: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  conference: string;
  division: string;
  marketTier: MarketTier;
  backstory: string;
}

export const INITIAL_FRANCHISES: InitialFranchise[] = [
  {
    name: "Aces",
    city: "Reno",
    state: "NV",
    abbreviation: "RNO",
    primaryColor: "#000000",
    secondaryColor: "#C0C0C0",
    accentColor: "#CC0000",
    conference: "Mountain",
    division: "Mountain",
    marketTier: "small",
    backstory:
      "Born from the neon glow and high-stakes spirit of the Biggest Little City, the Aces play every down like a winning hand. Their silver-and-black swagger reflects Reno's gritty reinvention from gaming town to mountain-sports hub.",
  },
  {
    name: "Roses",
    city: "Portland",
    state: "OR",
    abbreviation: "PDX",
    primaryColor: "#B22247",
    secondaryColor: "#FFFFFF",
    accentColor: "#1F4D2B",
    conference: "Pacific",
    division: "Pacific",
    marketTier: "medium",
    backstory:
      "Named for the City of Roses, Portland's franchise wears its bloom proudly. Rain or shine, the Roses play with thorns out — beautiful on the surface, brutal in the trenches.",
  },
  {
    name: "Republic",
    city: "Sacramento",
    state: "CA",
    abbreviation: "SAC",
    primaryColor: "#8B0000",
    secondaryColor: "#FFD700",
    accentColor: "#FFFFFF",
    conference: "Pacific",
    division: "Pacific",
    marketTier: "medium",
    backstory:
      "California's capital city stakes its claim with the Republic — a franchise built on civic pride and the golden promise of the Central Valley. Deep crimson and gold fly over a fanbase hungry to prove Sacramento belongs on any stage.",
  },
  {
    name: "Admirals",
    city: "San Diego",
    state: "CA",
    abbreviation: "SDG",
    primaryColor: "#002244",
    secondaryColor: "#FFFFFF",
    accentColor: "#F2A900",
    conference: "Pacific",
    division: "Pacific",
    marketTier: "large",
    backstory:
      "With a naval heritage stretching back generations, the Admirals command San Diego's waterfront with precision and pride. Sun-soaked fans pack the harbor-side stadium to watch a disciplined squad that mirrors the city's military tradition.",
  },
  {
    name: "Pioneers",
    city: "Salt Lake City",
    state: "UT",
    abbreviation: "SLC",
    primaryColor: "#4B0082",
    secondaryColor: "#FFFFFF",
    accentColor: "#A8A9AD",
    conference: "Mountain",
    division: "Mountain",
    marketTier: "medium",
    backstory:
      "Nestled against the Wasatch Range, the Pioneers carry the trailblazing spirit of Utah's founders onto the gridiron. Their purple-and-white banner symbolizes the rugged determination that carved a home out of the mountain frontier.",
  },
  {
    name: "Spuds",
    city: "Boise",
    state: "ID",
    abbreviation: "BOI",
    primaryColor: "#FF6600",
    secondaryColor: "#003B2F",
    accentColor: "#FFFFFF",
    conference: "Mountain",
    division: "Mountain",
    marketTier: "small",
    backstory:
      "Idaho's proudest export isn't just potatoes — it's the Spuds, a scrappy franchise that wears its agricultural roots with tongue-in-cheek swagger. Orange-and-teal faithful pack the stands in Boise, daring anyone to underestimate a team named after a tuber.",
  },
  {
    name: "Lava",
    city: "Honolulu",
    state: "HI",
    abbreviation: "HNL",
    primaryColor: "#CC0000",
    secondaryColor: "#000000",
    accentColor: "#FF8200",
    conference: "Pacific",
    division: "Pacific",
    marketTier: "small",
    backstory:
      "Erupting from the volcanic heart of the Pacific, the Lava bring island fire to the mainland. Honolulu's entry plays with an explosive, fast-paced style as fierce as the molten flows of Kīlauea.",
  },
  {
    name: "Roadrunners",
    city: "Albuquerque",
    state: "NM",
    abbreviation: "ABQ",
    primaryColor: "#00778B",
    secondaryColor: "#FFD700",
    accentColor: "#FFFFFF",
    conference: "Mountain",
    division: "Mountain",
    marketTier: "small",
    backstory:
      "Speeding across the high desert, the Roadrunners capture Albuquerque's wide-open frontier energy. Teal and gold flash under the Sandia Mountain sunset as this franchise races to outrun every expectation.",
  },
];
