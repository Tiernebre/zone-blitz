export interface CoachesGenerateInput {
  leagueId: string;
  teamIds: string[];
}

export interface CoachesGenerateResult {
  coachCount: number;
}

export interface CoachesService {
  generateAndPersist(
    input: CoachesGenerateInput,
  ): Promise<CoachesGenerateResult>;
}
