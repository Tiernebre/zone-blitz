import type { TeamDivisionInfo } from "./schedule.generator.interface.ts";
import type { Executor } from "../../db/connection.ts";

export interface ScheduleGenerateInput {
  seasonId: string;
  teams: TeamDivisionInfo[];
}

export interface ScheduleGenerateResult {
  gameCount: number;
}

export interface ScheduleService {
  generate(
    input: ScheduleGenerateInput,
    tx?: Executor,
  ): Promise<ScheduleGenerateResult>;
}
