import type { NeutralBucket } from "../archetypes/neutral-bucket.ts";

export const SCHEME_ARCHETYPES = [
  "pocket passer",
  "dual-threat QB",
  "gunslinger",
  "zone RB",
  "power RB",
  "receiving RB",
  "X receiver",
  "slot receiver",
  "possession receiver",
  "blocking TE",
  "move TE",
  "zone OT",
  "power OT",
  "zone guard",
  "power guard",
  "stand-up OLB",
  "speed DE",
  "nose tackle",
  "3-tech",
  "run-stuff LB",
  "coverage LB",
  "press-man CB",
  "zone CB",
  "slot CB",
  "box safety",
  "free safety",
] as const;

export type SchemeArchetype = (typeof SCHEME_ARCHETYPES)[number];

export type SchemeLensResult = SchemeArchetype | null;

export const OFFENSIVE_BUCKETS: readonly NeutralBucket[] = [
  "QB",
  "RB",
  "WR",
  "TE",
  "OT",
  "IOL",
];

export const DEFENSIVE_BUCKETS: readonly NeutralBucket[] = [
  "EDGE",
  "IDL",
  "LB",
  "CB",
  "S",
];

export const SPECIALIST_BUCKETS: readonly NeutralBucket[] = ["K", "P", "LS"];
