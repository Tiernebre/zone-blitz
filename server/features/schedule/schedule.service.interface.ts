import type { TeamDivisionInfo } from "./schedule.generator.interface.ts";

export interface ScheduleGenerateInput {
  seasonId: string;
  teams: TeamDivisionInfo[];
  seasonLength: number;
}

export interface ScheduleGenerateResult {
  gameCount: number;
}

export interface ScheduleService {
  generate(
    input: ScheduleGenerateInput,
  ): Promise<ScheduleGenerateResult>;
}
