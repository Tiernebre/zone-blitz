import type { FrontOfficeStaff, Scout } from "@zone-blitz/shared";

export interface PersonnelGeneratorInput {
  leagueId: string;
  teamIds: string[];
}

export interface GeneratedPersonnel {
  scouts: Omit<Scout, "id" | "createdAt" | "updatedAt">[];
  frontOfficeStaff: Omit<FrontOfficeStaff, "id" | "createdAt" | "updatedAt">[];
}

export interface PersonnelGenerator {
  generate(input: PersonnelGeneratorInput): GeneratedPersonnel;
}
