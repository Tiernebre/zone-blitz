export interface FrontOfficeGenerateInput {
  leagueId: string;
  teamIds: string[];
}

export interface FrontOfficeGenerateResult {
  frontOfficeCount: number;
}

export interface FrontOfficeService {
  generate(
    input: FrontOfficeGenerateInput,
  ): Promise<FrontOfficeGenerateResult>;
}
