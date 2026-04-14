export interface ScoutsGenerateInput {
  leagueId: string;
  teamIds: string[];
}

export interface ScoutsGenerateResult {
  scoutCount: number;
}

export interface ScoutsService {
  generate(input: ScoutsGenerateInput): Promise<ScoutsGenerateResult>;
}
