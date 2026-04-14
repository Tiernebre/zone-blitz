import type { Coach } from "@zone-blitz/shared";

export interface CoachesGeneratorInput {
  leagueId: string;
  teamIds: string[];
}

export type GeneratedCoach = Omit<Coach, "id" | "createdAt" | "updatedAt">;

export interface CoachesGenerator {
  generate(input: CoachesGeneratorInput): GeneratedCoach[];
}
