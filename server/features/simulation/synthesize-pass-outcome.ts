import type { PlayOutcome, PlayTag } from "./events.ts";
import type { MatchupContribution, Situation } from "./resolve-play.ts";
import { PASS_COEFFICIENTS } from "./outcome-coefficients.ts";
import type { SeededRng } from "./rng.ts";
import { observePassScore } from "./score-observer.ts";
import type { OutcomeResult } from "./synthesize-run-outcome.ts";

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export function synthesizePassOutcome(
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
  let outcome: PlayOutcome;
  let yardage: number;

  const protectionContribs = contributions.filter(
    (c) =>
      c.matchup.type === "pass_protection" ||
      c.matchup.type === "pass_rush",
  );
  const protectionScore = protectionContribs.length > 0
    ? protectionContribs.reduce((s, c) => s + c.score, 0) /
      protectionContribs.length
    : avgScore;

  const routeContribs = contributions.filter(
    (c) => c.matchup.type === "route_coverage",
  );
  const coverageScore = routeContribs.length > 0
    ? routeContribs.reduce((s, c) => s + c.score, 0) /
      routeContribs.length
    : avgScore;
  observePassScore(protectionScore, coverageScore);

  // Sigmoid probability rolls — no floors/ceilings needed because
  // σ(·) is already bounded in (0, 1) and monotonic in its argument.
  const sackProb = sigmoid(
    PASS_COEFFICIENTS.sack.intercept +
      PASS_COEFFICIENTS.sack.slope * protectionScore,
  );

  if (rng.next() < sackProb) {
    outcome = "sack";
    yardage = rng.int(
      PASS_COEFFICIENTS.sackYards.min,
      PASS_COEFFICIENTS.sackYards.max,
    );
    tags.push("sack", "pressure");

    const rusher = contributions.find((c) =>
      c.matchup.type === "pass_rush" ||
      (c.matchup.type === "pass_protection" && c.score < 0)
    );
    if (rusher) {
      const idx = participants.findIndex(
        (p) => p.playerId === rusher.matchup.defender.playerId,
      );
      if (idx >= 0) {
        participants[idx].tags.push("sack");
      } else {
        participants.push({
          role: "pass_rush",
          playerId: rusher.matchup.defender.playerId,
          tags: ["sack"],
        });
      }
    }

    if (rng.next() < PASS_COEFFICIENTS.fumbleOnSack) {
      outcome = "fumble";
      tags.push("fumble", "turnover");
    }
  } else {
    if (protectionScore < -5) {
      tags.push("pressure");
    }

    const intProb = sigmoid(
      PASS_COEFFICIENTS.interception.intercept +
        PASS_COEFFICIENTS.interception.slope * coverageScore,
    );
    const completionProb = sigmoid(
      PASS_COEFFICIENTS.completion.intercept +
        PASS_COEFFICIENTS.completion.slope * coverageScore,
    );
    const bigPlayProb = sigmoid(
      PASS_COEFFICIENTS.bigPlay.intercept +
        PASS_COEFFICIENTS.bigPlay.slope * coverageScore,
    );

    const roll = rng.next();
    if (roll < intProb) {
      outcome = "interception";
      yardage = 0;
      tags.push("interception", "turnover");

      const interceptor = routeContribs.find((c) => c.score < -5) ??
        routeContribs[0];
      if (interceptor) {
        const idx = participants.findIndex(
          (p) => p.playerId === interceptor.matchup.defender.playerId,
        );
        if (idx >= 0) {
          participants[idx].tags.push("interception");
        } else {
          participants.push({
            role: "route_coverage",
            playerId: interceptor.matchup.defender.playerId,
            tags: ["interception"],
          });
        }
      }
    } else if (roll < intProb + completionProb) {
      outcome = "pass_complete";
      const isBigPlay = rng.next() < bigPlayProb;
      if (isBigPlay) {
        yardage = rng.int(
          PASS_COEFFICIENTS.bigPlayYards.min,
          PASS_COEFFICIENTS.bigPlayYards.max,
        );
        tags.push("big_play");
      } else {
        yardage = rng.int(
          PASS_COEFFICIENTS.completionYards.min,
          PASS_COEFFICIENTS.completionYards.max,
        );
      }
      const target = routeContribs.find((c) => c.score > 0) ??
        routeContribs[0];
      if (target) {
        const idx = participants.findIndex(
          (p) => p.playerId === target.matchup.attacker.playerId,
        );
        if (idx >= 0) participants[idx].tags.push("target", "reception");
      }
    } else {
      outcome = "pass_incomplete";
      yardage = 0;
    }

    if (outcome === "pass_complete" && yardage >= situation.distance) {
      tags.push("first_down");
    }
  }

  return { outcome: outcome!, yardage: yardage!, tags, participants };
}
