import type { Executor } from "../../db/connection.ts";

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
    tx?: Executor,
  ): Promise<FrontOfficeGenerateResult>;
}
