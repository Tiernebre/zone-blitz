import type {
  CapArchetype,
  ContractBonusSource,
  ContractGuaranteeType,
  ContractTagType,
  Player,
  PlayerAttributes,
} from "@zone-blitz/shared";

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
  teamArchetypes?: Map<string, CapArchetype>;
}

export interface GeneratedContract {
  playerId: string;
  teamId: string;
  signedYear: number;
  totalYears: number;
  realYears: number;
  signingBonus: number;
  isRookieDeal: boolean;
  rookieDraftPick: number | null;
  tagType: ContractTagType | null;
}

export interface GeneratedContractYear {
  leagueYear: number;
  base: number;
  rosterBonus: number;
  workoutBonus: number;
  perGameRosterBonus: number;
  guaranteeType: ContractGuaranteeType;
  isVoid: boolean;
}

export interface GeneratedBonusProration {
  amount: number;
  firstYear: number;
  years: number;
  source: ContractBonusSource;
}

export interface GeneratedContractBundle {
  contract: GeneratedContract;
  years: GeneratedContractYear[];
  bonusProrations: GeneratedBonusProration[];
}

export interface PlayersGenerator {
  generate(input: PlayersGeneratorInput): GeneratedPlayers;
  generateContracts(
    input: ContractGeneratorInput,
  ): GeneratedContractBundle[];
}
