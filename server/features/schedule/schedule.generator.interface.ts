import type { Game } from "@zone-blitz/shared";

export interface TeamDivisionInfo {
  teamId: string;
  conference: string;
  division: string;
}

export interface ScheduleGeneratorInput {
  seasonId: string;
  teams: TeamDivisionInfo[];
  seasonLength: number;
}

export type GeneratedGame = Omit<Game, "id" | "createdAt" | "updatedAt">;

export interface ScheduleGenerator {
  generate(input: ScheduleGeneratorInput): GeneratedGame[];
}
