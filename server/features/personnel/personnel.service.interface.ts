export interface PersonnelGenerateInput {
  leagueId: string;
  seasonId: string;
  teamIds: string[];
  rosterSize: number;
  salaryCap: number;
}

export interface PersonnelGenerateResult {
  playerCount: number;
  coachCount: number;
  scoutCount: number;
  frontOfficeCount: number;
  draftProspectCount: number;
  contractCount: number;
}

export interface PersonnelService {
  generateAndPersist(
    input: PersonnelGenerateInput,
  ): Promise<PersonnelGenerateResult>;
}
