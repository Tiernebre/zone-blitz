export interface CoachesGenerateInput {
  leagueId: string;
  teamIds: string[];
}

export interface CoachesGenerateResult {
  coachCount: number;
}

export interface CoachesService {
  generate(
    input: CoachesGenerateInput,
  ): Promise<CoachesGenerateResult>;
}
