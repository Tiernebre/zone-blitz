import type { Scout } from "@zone-blitz/shared";

export interface ScoutsGeneratorInput {
  leagueId: string;
  teamIds: string[];
}

export interface ScoutsPoolInput {
  leagueId: string;
  numberOfTeams: number;
}

/**
 * A scout record as produced by the generator — the shape of a row ready
 * for insertion into the `scouts` table. `id` is pre-assigned so that
 * `reportsToId` can reference siblings without a post-insert stitching
 * pass.
 */
export type GeneratedScout = Omit<Scout, "createdAt" | "updatedAt">;

export interface ScoutsGenerator {
  generate(input: ScoutsGeneratorInput): GeneratedScout[];
  generatePool(input: ScoutsPoolInput): GeneratedScout[];
}
