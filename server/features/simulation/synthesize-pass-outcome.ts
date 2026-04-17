import type { PlayOutcome, PlayTag } from "./events.ts";
import type { MatchupContribution, Situation } from "./resolve-play.ts";
import { PASS_RESOLUTION, SACK_YARDAGE } from "./resolve-play.ts";
import type { SeededRng } from "./rng.ts";
import { observePassScore } from "./score-observer.ts";
import type { OutcomeResult } from "./synthesize-run-outcome.ts";

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

  const sackProb = Math.max(
    PASS_RESOLUTION.sack.floor,
    PASS_RESOLUTION.sack.base -
      protectionScore * PASS_RESOLUTION.sack.protectionModifier,
  );
  if (rng.next() < sackProb) {
    outcome = "sack";
    yardage = rng.int(SACK_YARDAGE.min, SACK_YARDAGE.max);
    tags.push("sack", "pressure");

    const rusher = contributions.find((c) =>
      c.matchup.type === "pass_rush" ||
      (c.matchup.type === "pass_protection" &&
        c.score < 0)
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

    if (rng.next() < PASS_RESOLUTION.fumbleOnSack) {
      outcome = "fumble";
      tags.push("fumble", "turnover");
    }
  } else {
    if (protectionScore < -5) {
      tags.push("pressure");
    }

    const intProb = Math.max(
      PASS_RESOLUTION.interception.floor,
      PASS_RESOLUTION.interception.base -
        coverageScore * PASS_RESOLUTION.interception.coverageModifier,
    );
    const completionProb = Math.max(
      PASS_RESOLUTION.completion.floor,
      Math.min(
        PASS_RESOLUTION.completion.ceiling,
        PASS_RESOLUTION.completion.base +
          coverageScore * PASS_RESOLUTION.completion.coverageModifier,
      ),
    );
    const bigPlayProb = Math.max(
      PASS_RESOLUTION.bigPlay.floor,
      Math.min(
        PASS_RESOLUTION.bigPlay.ceiling,
        PASS_RESOLUTION.bigPlay.base +
          coverageScore * PASS_RESOLUTION.bigPlay.coverageModifier,
      ),
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
          PASS_RESOLUTION.bigPlay.yards.min,
          PASS_RESOLUTION.bigPlay.yards.max,
        );
        tags.push("big_play");
      } else {
        yardage = rng.int(
          PASS_RESOLUTION.completionYards.min,
          PASS_RESOLUTION.completionYards.max,
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

    if (
      outcome === "pass_complete" && yardage >= situation.distance
    ) {
      tags.push("first_down");
    }
  }

  return { outcome: outcome!, yardage: yardage!, tags, participants };
}
