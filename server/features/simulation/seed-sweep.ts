import {
  computeSeasonAggregates,
  type SeasonAggregates,
} from "./season-aggregates.ts";
import { type SeasonInput, simulateSeason } from "./simulate-season.ts";

export interface BandStats {
  mean: number;
  stddev: number;
  min: number;
  max: number;
}

export interface SweepResult {
  seeds: number[];
  playsPerGame: BandStats;
  passPercentage: BandStats;
  rushPercentage: BandStats;
  completionPercentage: BandStats;
  yardsPerAttempt: BandStats;
  yardsPerCarry: BandStats;
  sacksPerTeamPerGame: BandStats;
  turnoversPerTeamPerGame: BandStats;
  averageElapsedMs: number;
}

function computeBandStats(values: number[]): BandStats {
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
  return {
    mean,
    stddev: Math.sqrt(variance),
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

export function seedSweep(
  seeds: number[],
  options?: Partial<Omit<SeasonInput, "leagueSeed">>,
): SweepResult {
  const aggregates: SeasonAggregates[] = [];
  const elapsed: number[] = [];

  for (const seed of seeds) {
    const season = simulateSeason({
      leagueSeed: seed,
      ...options,
    });
    aggregates.push(computeSeasonAggregates(season.results));
    elapsed.push(season.elapsedMs);
  }

  return {
    seeds,
    playsPerGame: computeBandStats(aggregates.map((a) => a.playsPerGame)),
    passPercentage: computeBandStats(aggregates.map((a) => a.passPercentage)),
    rushPercentage: computeBandStats(aggregates.map((a) => a.rushPercentage)),
    completionPercentage: computeBandStats(
      aggregates.map((a) => a.completionPercentage),
    ),
    yardsPerAttempt: computeBandStats(
      aggregates.map((a) => a.yardsPerAttempt),
    ),
    yardsPerCarry: computeBandStats(aggregates.map((a) => a.yardsPerCarry)),
    sacksPerTeamPerGame: computeBandStats(
      aggregates.map((a) => a.sacksPerTeamPerGame),
    ),
    turnoversPerTeamPerGame: computeBandStats(
      aggregates.map((a) => a.turnoversPerTeamPerGame),
    ),
    averageElapsedMs: elapsed.reduce((a, b) => a + b, 0) / elapsed.length,
  };
}
