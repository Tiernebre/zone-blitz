import type {
  Coach,
  Contract,
  DraftProspect,
  FrontOfficeStaff,
  Player,
  Scout,
} from "@zone-blitz/shared";

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

export interface ContractGeneratorInput {
  salaryCap: number;
  players: Pick<Player, "id" | "teamId">[];
}

export type GeneratedContract = Omit<
  Contract,
  "id" | "createdAt" | "updatedAt"
>;

export interface PersonnelGenerator {
  generate(input: PersonnelGeneratorInput): GeneratedPersonnel;
  generateContracts(input: ContractGeneratorInput): GeneratedContract[];
}
