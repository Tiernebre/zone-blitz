import type { Contract, DraftProspect, Player } from "@zone-blitz/shared";

export interface PlayersGeneratorInput {
  leagueId: string;
  seasonId: string;
  teamIds: string[];
  rosterSize: number;
}

export interface GeneratedPlayers {
  players: Omit<Player, "id" | "createdAt" | "updatedAt">[];
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

export interface PlayersGenerator {
  generate(input: PlayersGeneratorInput): GeneratedPlayers;
  generateContracts(input: ContractGeneratorInput): GeneratedContract[];
}
