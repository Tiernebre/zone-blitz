import type { FrontOfficeStaff } from "@zone-blitz/shared";

export interface FrontOfficeGeneratorInput {
  leagueId: string;
  teamIds: string[];
}

export type GeneratedFrontOfficeStaff = Omit<
  FrontOfficeStaff,
  "id" | "createdAt" | "updatedAt"
>;

export interface FrontOfficeGenerator {
  generate(input: FrontOfficeGeneratorInput): GeneratedFrontOfficeStaff[];
}
