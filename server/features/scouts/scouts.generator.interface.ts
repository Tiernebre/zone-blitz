import type { Scout } from "@zone-blitz/shared";

export interface ScoutsGeneratorInput {
  leagueId: string;
  teamIds: string[];
}

export type GeneratedScout = Omit<Scout, "id" | "createdAt" | "updatedAt">;

export interface ScoutsGenerator {
  generate(input: ScoutsGeneratorInput): GeneratedScout[];
}
