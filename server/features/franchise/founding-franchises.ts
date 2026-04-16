export interface FoundingFranchise {
  name: string;
  city: string;
  state: string;
  abbreviation: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  conference: string;
  division: string;
}

export const FOUNDING_FRANCHISES: FoundingFranchise[] = [
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
  },
  {
    name: "Riveters",
    city: "Portland",
    state: "OR",
    abbreviation: "PDX",
    primaryColor: "#004225",
    secondaryColor: "#FFFFFF",
    accentColor: "#A8A9AD",
    conference: "Pacific",
    division: "Pacific",
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
  },
];
