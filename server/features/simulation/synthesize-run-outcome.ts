import type { PlayOutcome, PlayTag } from "./events.ts";
import type { MatchupContribution, Situation } from "./resolve-play.ts";
import { RUN_RESOLUTION } from "./resolve-play.ts";
import type { SeededRng } from "./rng.ts";

export interface OutcomeResult {
  outcome: PlayOutcome;
  yardage: number;
  tags: PlayTag[];
  participants: { role: string; playerId: string; tags: string[] }[];
}

export function synthesizeRunOutcome(
  contributions: MatchupContribution[],
  situation: Situation,
  rng: SeededRng,
): OutcomeResult {
  const avgScore = contributions.length > 0
    ? contributions.reduce((sum, c) => sum + c.score, 0) / contributions.length
    : 0;

  const participants = contributions.map((c) => ({
    role: c.matchup.type,
    playerId: c.matchup.attacker.playerId,
    tags: [] as string[],
  }));

  const tags: PlayTag[] = [];

  const blockingContribs = contributions.filter(
    (c) => c.matchup.type === "run_block" || c.matchup.type === "run_defense",
  );
  const blockScore = blockingContribs.length > 0
    ? blockingContribs.reduce((s, c) => s + c.score, 0) /
      blockingContribs.length
    : avgScore;

  let yardage: number;
  if (blockScore < RUN_RESOLUTION.stuffThreshold) {
    yardage = rng.int(
      RUN_RESOLUTION.stuffYards.min,
      RUN_RESOLUTION.stuffYards.max,
    );
  } else if (blockScore < RUN_RESOLUTION.shortGainThreshold) {
    yardage = rng.int(
      RUN_RESOLUTION.shortGainYards.min,
      RUN_RESOLUTION.shortGainYards.max,
    );
  } else if (blockScore > RUN_RESOLUTION.bigPlayThreshold) {
    yardage = rng.int(
      RUN_RESOLUTION.bigPlayYards.min,
      RUN_RESOLUTION.bigPlayYards.max,
    );
    tags.push("big_play");
  } else {
    yardage = rng.int(
      RUN_RESOLUTION.normalYards.min,
      RUN_RESOLUTION.normalYards.max,
    );
  }

  let outcome: PlayOutcome;
  if (rng.next() < RUN_RESOLUTION.fumbleRate) {
    outcome = "fumble";
    tags.push("fumble", "turnover");
  } else {
    outcome = "rush";
  }

  if (yardage >= situation.distance) {
    tags.push("first_down");
  }

  const rb = contributions.find(
    (c) => c.matchup.attacker.neutralBucket === "RB",
  );
  if (rb) {
    const idx = participants.findIndex(
      (p) => p.playerId === rb.matchup.attacker.playerId,
    );
    if (idx >= 0) participants[idx].tags.push("ball_carrier");
  }

  return { outcome, yardage, tags, participants };
}
