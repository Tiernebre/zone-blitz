import type { Contract, Player, PlayerAttributes } from "@zone-blitz/shared";

export interface PlayersGeneratorInput {
  leagueId: string;
  seasonId: string;
  teamIds: string[];
  rosterSize: number;
}

export interface GeneratedPlayer {
  player: Omit<Player, "id" | "createdAt" | "updatedAt">;
  attributes: PlayerAttributes;
}

export interface GeneratedPlayers {
  players: GeneratedPlayer[];
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
