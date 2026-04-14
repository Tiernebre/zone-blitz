import type { Coach, FrontOfficeStaff, Scout } from "@zone-blitz/shared";

export interface PersonnelGeneratorInput {
  leagueId: string;
  teamIds: string[];
}

export interface GeneratedPersonnel {
  coaches: Omit<Coach, "id" | "createdAt" | "updatedAt">[];
  scouts: Omit<Scout, "id" | "createdAt" | "updatedAt">[];
  frontOfficeStaff: Omit<FrontOfficeStaff, "id" | "createdAt" | "updatedAt">[];
}

export interface PersonnelGenerator {
  generate(input: PersonnelGeneratorInput): GeneratedPersonnel;
}
