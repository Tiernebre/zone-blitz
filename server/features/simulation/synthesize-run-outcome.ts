import type { PlayOutcome, PlayTag } from "./events.ts";
import type { MatchupContribution, Situation } from "./resolve-play.ts";
import { RUN_COEFFICIENTS } from "./outcome-coefficients.ts";
import type { SeededRng } from "./rng.ts";
import { observeRunScore } from "./score-observer.ts";

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
  observeRunScore(blockScore);

  // Continuous monotonic yardage model: a single Gaussian centered on
  // `yardageIntercept + yardageSlope · blockScore`, clamped to the
  // configured realistic NFL rush range. No cliffs — a 1-point blockScore
  // shift moves yardage by β yards in expectation.
  const yardageMean = RUN_COEFFICIENTS.yardageIntercept +
    RUN_COEFFICIENTS.yardageSlope * blockScore;
  const yardage = Math.round(
    rng.gaussian(
      yardageMean,
      RUN_COEFFICIENTS.yardageStddev,
      RUN_COEFFICIENTS.yardageMin,
      RUN_COEFFICIENTS.yardageMax,
    ),
  );

  if (yardage >= RUN_COEFFICIENTS.bigPlayCutoff) {
    tags.push("big_play");
  }

  let outcome: PlayOutcome;
  if (rng.next() < RUN_COEFFICIENTS.fumbleRate) {
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
