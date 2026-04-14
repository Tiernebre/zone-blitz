import type { Executor } from "../../db/connection.ts";

export interface PublishDepthChartsInput {
  leagueId: string;
  teamIds: string[];
}

export interface PublishDepthChartsResult {
  entryCount: number;
}

export interface DepthChartPublisher {
  publishForTeams(
    input: PublishDepthChartsInput,
    tx?: Executor,
  ): Promise<PublishDepthChartsResult>;
}
