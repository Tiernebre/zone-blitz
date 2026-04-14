/**
 * Qualitative label returned by `computeSchemeFit`. Per ADR 0005 the
 * Roster Fit indicator is only ever rendered as one of these buckets
 * — no numeric fit score is exposed to the user.
 */
export type SchemeFitLabel = "ideal" | "fits" | "neutral" | "poor" | "miscast";

export const SCHEME_FIT_LABELS: readonly SchemeFitLabel[] = [
  "ideal",
  "fits",
  "neutral",
  "poor",
  "miscast",
] as const;
