export interface PlayersGenerateInput {
  leagueId: string;
  seasonId: string;
  teamIds: string[];
  rosterSize: number;
  salaryCap: number;
}

export interface PlayersGenerateResult {
  playerCount: number;
  draftProspectCount: number;
  contractCount: number;
}

export interface PlayersService {
  generate(
    input: PlayersGenerateInput,
  ): Promise<PlayersGenerateResult>;
}
