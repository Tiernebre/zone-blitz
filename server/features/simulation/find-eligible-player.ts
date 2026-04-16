import type { NeutralBucket } from "@zone-blitz/shared";
import type { PlayerRuntime } from "./resolve-play.ts";

export const KICKER_POSITIONS: NeutralBucket[] = ["K"];
export const RETURNER_POSITIONS: NeutralBucket[] = ["WR", "RB"];
export const COVERAGE_UNIT_POSITIONS: NeutralBucket[] = ["LB", "S", "CB"];

interface FindOptions {
  positions: NeutralBucket[];
  injuredIds: Set<string>;
  fallback?: PlayerRuntime;
}

interface FindManyOptions {
  positions: NeutralBucket[];
  injuredIds: Set<string>;
  limit?: number;
}

export function findEligiblePlayer(
  roster: PlayerRuntime[],
  options: FindOptions,
): PlayerRuntime | undefined {
  const available = roster.filter(
    (p) => !options.injuredIds.has(p.playerId),
  );
  for (const pos of options.positions) {
    const player = available.find((p) => p.neutralBucket === pos);
    if (player) return player;
  }
  return options.fallback;
}

export function findEligiblePlayers(
  roster: PlayerRuntime[],
  options: FindManyOptions,
): PlayerRuntime[] {
  const available = roster.filter(
    (p) => !options.injuredIds.has(p.playerId),
  );
  const matches = available.filter((p) =>
    options.positions.includes(p.neutralBucket)
  );
  return options.limit !== undefined
    ? matches.slice(0, options.limit)
    : matches;
}
