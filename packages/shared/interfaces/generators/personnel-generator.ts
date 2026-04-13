import type {
  Coach,
  DraftProspect,
  FrontOfficeStaff,
  Player,
  Scout,
} from "../../types/personnel.ts";

export interface PersonnelGeneratorInput {
  leagueId: string;
  seasonId: string;
  teamIds: string[];
  rosterSize: number;
}

export interface GeneratedPersonnel {
  players: Omit<Player, "id" | "createdAt" | "updatedAt">[];
  coaches: Omit<Coach, "id" | "createdAt" | "updatedAt">[];
  scouts: Omit<Scout, "id" | "createdAt" | "updatedAt">[];
  frontOfficeStaff: Omit<FrontOfficeStaff, "id" | "createdAt" | "updatedAt">[];
  draftProspects: Omit<DraftProspect, "id" | "createdAt" | "updatedAt">[];
}

export interface PersonnelGenerator {
  generate(input: PersonnelGeneratorInput): GeneratedPersonnel;
}
