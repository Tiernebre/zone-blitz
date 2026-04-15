import type { PlayEvent, PlayOutcome } from "./events.ts";
import type { GameState, PlayerRuntime, TeamRuntime } from "./resolve-play.ts";
import { resolvePlay } from "./resolve-play.ts";
import type { SeededRng } from "./rng.ts";

export type ConversionChoice = "xp" | "two_point";

export function conversionDecision(
  scoreDiff: number,
  quarter: 1 | 2 | 3 | 4 | "OT",
  _clock: string,
  hcAggressiveness: number,
): ConversionChoice {
  // NFL 2PT attempt rate is ~5-8%. Go for 2 when trailing by specific amounts
  // late, or when coach aggressiveness is high enough.
  const q = typeof quarter === "number" ? quarter : 5;

  // Down 2: a successful 2PT ties instead of trailing by 1
  if (scoreDiff === -2 && q >= 4) return "two_point";
  // Down 8: need TD+2PT to tie
  if (scoreDiff === -8) return "two_point";
  // Down 15: two scores, need at least one 2PT
  if (scoreDiff === -15 && q >= 3) return "two_point";

  // Aggressive coaches go for 2 more often late
  const aggressivenessThreshold = q >= 4 ? 80 : 92;
  if (hcAggressiveness >= aggressivenessThreshold) {
    return "two_point";
  }

  return "xp";
}

export function resolveExtraPoint(
  kicker: PlayerRuntime | undefined,
  rng: SeededRng,
): boolean {
  const accuracy = kicker?.attributes.kickingAccuracy ?? 50;
  // NFL XP success rate ~94%. Scale from ~88% (accuracy=30) to ~98% (accuracy=90).
  const baseProbability = 0.88 + (accuracy - 30) * (0.10 / 60);
  const probability = Math.max(0.80, Math.min(0.99, baseProbability));
  return rng.next() < probability;
}

export function resolveTwoPointConversion(
  gameState: GameState,
  offense: TeamRuntime,
  defense: TeamRuntime,
  rng: SeededRng,
): PlayEvent {
  const twoPointState: GameState = {
    ...gameState,
    situation: { down: 1, distance: 2, yardLine: 98 },
  };

  const event = resolvePlay(twoPointState, offense, defense, rng);
  const naturallyScored = event.outcome === "touchdown" ||
    (event.yardage >= 2 && !event.tags.includes("turnover"));

  // Goal-line defense compression: the matchup pipeline doesn't model
  // stacked-box goal-line formations, so apply a compression roll to
  // bring 2PT success rates into NFL range (~48%).
  const success = naturallyScored && rng.next() < 0.50;

  return {
    ...event,
    outcome: "two_point" as PlayOutcome,
    tags: success
      ? [...event.tags.filter((t) => t !== "touchdown"), "two_point_conversion"]
      : event.tags.filter((t) => t !== "touchdown" && t !== "first_down"),
  };
}

export function detectSafety(
  yardage: number,
  yardLine: number,
  outcome: PlayOutcome,
): boolean {
  // Safety occurs when the offense is tackled/grounded in their own end zone.
  // yardLine is offense-relative (own 1 = closest to own end zone).
  // A play that pushes the ball carrier behind the goal line (yardLine + yardage <= 0)
  // is a safety.
  if (outcome === "field_goal" || outcome === "punt") return false;
  const resultYard = yardLine + yardage;
  return resultYard <= 0;
}

export function resolveReturnTd(
  defender: PlayerRuntime | undefined,
  rng: SeededRng,
): boolean {
  // NFL return TD rate on turnovers ~3-5%.
  // Driven by defender speed and open-field attributes.
  const speed = defender?.attributes.speed ?? 50;
  const acceleration = defender?.attributes.acceleration ?? 50;
  const avgAttr = (speed + acceleration) / 2;
  // Scale from ~2% (attr=30) to ~8% (attr=90)
  const probability = 0.02 + (avgAttr - 30) * (0.06 / 60);
  return rng.next() < Math.max(0.01, Math.min(0.10, probability));
}

export function findKicker(
  players: PlayerRuntime[],
): PlayerRuntime | undefined {
  return players.find((p) => p.neutralBucket === "K");
}

export function findTurnoverDefender(
  event: PlayEvent,
): string | undefined {
  const intParticipant = event.participants.find((p) =>
    p.tags.includes("interception")
  );
  if (intParticipant) return intParticipant.playerId;

  const fumbleRecovery = event.participants.find((p) =>
    p.tags.includes("fumble_recovery")
  );
  if (fumbleRecovery) return fumbleRecovery.playerId;

  // For fumbles without a tagged recovery player, pick the first defensive participant
  const defensiveParticipant = event.participants.find((p) =>
    p.role === "pass_rush" || p.role === "route_coverage" ||
    p.role === "run_defense"
  );
  return defensiveParticipant?.playerId;
}
