import type { FrontOfficeStaff } from "@zone-blitz/shared";

export interface PersonnelGeneratorInput {
  leagueId: string;
  teamIds: string[];
}

export interface GeneratedPersonnel {
  frontOfficeStaff: Omit<FrontOfficeStaff, "id" | "createdAt" | "updatedAt">[];
}

export interface PersonnelGenerator {
  generate(input: PersonnelGeneratorInput): GeneratedPersonnel;
}
