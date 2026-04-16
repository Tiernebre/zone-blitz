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
    primaryColor: "#1A1A2E",
    secondaryColor: "#C9A227",
    accentColor: "#E74C3C",
    conference: "Mountain",
    division: "Mountain",
  },
  {
    name: "Riveters",
    city: "Portland",
    state: "OR",
    abbreviation: "PDX",
    primaryColor: "#2D4A3E",
    secondaryColor: "#D4856B",
    accentColor: "#F5F0E1",
    conference: "Pacific",
    division: "Pacific",
  },
  {
    name: "Republic",
    city: "Sacramento",
    state: "CA",
    abbreviation: "SAC",
    primaryColor: "#8B2331",
    secondaryColor: "#C4A34D",
    accentColor: "#FFFFFF",
    conference: "Pacific",
    division: "Pacific",
  },
  {
    name: "Admirals",
    city: "San Diego",
    state: "CA",
    abbreviation: "SDG",
    primaryColor: "#003459",
    secondaryColor: "#D4AF37",
    accentColor: "#FFFFFF",
    conference: "Pacific",
    division: "Pacific",
  },
  {
    name: "Pioneers",
    city: "Salt Lake City",
    state: "UT",
    abbreviation: "SLC",
    primaryColor: "#5B3A29",
    secondaryColor: "#E8D5B7",
    accentColor: "#3A7D44",
    conference: "Mountain",
    division: "Mountain",
  },
  {
    name: "Spuds",
    city: "Boise",
    state: "ID",
    abbreviation: "BOI",
    primaryColor: "#6B4226",
    secondaryColor: "#F7DC6F",
    accentColor: "#2ECC71",
    conference: "Mountain",
    division: "Mountain",
  },
  {
    name: "Lava",
    city: "Honolulu",
    state: "HI",
    abbreviation: "HNL",
    primaryColor: "#B22222",
    secondaryColor: "#FF8C00",
    accentColor: "#1C1C1C",
    conference: "Pacific",
    division: "Pacific",
  },
  {
    name: "Roadrunners",
    city: "Albuquerque",
    state: "NM",
    abbreviation: "ABQ",
    primaryColor: "#C75B12",
    secondaryColor: "#40E0D0",
    accentColor: "#F5DEB3",
    conference: "Mountain",
    division: "Mountain",
  },
];
