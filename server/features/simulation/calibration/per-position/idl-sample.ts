import type { GameResult, PlayEvent } from "../../events.ts";
import type { SimTeam } from "../../simulate-game.ts";
import { idlOverall } from "./idl-overall.ts";

export interface IdlGameSample {
  teamId: string;
  idlPlayerId: string;
  idlOverall: number;
  sacks: number;
  qb_hits: number;
  tfl: number;
  tackles: number;
  sacks_per_game: number;
  qb_hits_per_game: number;
  tfl_per_game: number;
  tackles_per_game: number;
}

// ------------------------------------------------------------------
// ATTRIBUTION GAP — read before changing the numbers in this file.
//
// The engine only logs per-defender events for SACKS (the pass_rush
// participant is tagged `sack` inside `synthesize-pass-outcome.ts`).
// Tackles, tackles-for-loss, and QB hits are not attributed to any
// specific defender — they're computed as team-level proxies:
//   * tackles   — every rush play against a team counts as one team
//                 tackle (whoever finished the carry).
//   * tfl       — rush plays stuffed for <1 yard.
//   * qb_hits   — non-sack pass plays that the engine flagged with a
//                 `pressure` tag (see `synthesize-pass-outcome.ts`).
//
// Those team-level counts are then split evenly across the team's
// starter IDLs on the field. This mirrors the approach nflreadr's
// counting-stat bands take — the sim knows roughly how many stops
// happened, but can't yet distinguish the IDL who made the tackle
// from the EDGE or LB who was also in the pile. That attribution gap
// inflates the IDL tackle/TFL numbers relative to the NFL reference
// (we over-credit the IDL for stops actually made by LBs/EDGEs), so
// calibration consumers should expect the `tackles_per_game` and
// `tfl_per_game` checks to run hot on this slice until the engine
// starts logging tackle/TFL participants.
// ------------------------------------------------------------------

const RUN_CONCEPTS = new Set([
  "inside_zone",
  "outside_zone",
  "power",
  "counter",
  "draw",
  "rpo",
]);

const TFL_YARDAGE_THRESHOLD = 1;

interface TeamRunStopProxies {
  tackles: number;
  tfl: number;
  qb_hits: number;
}

function teamRunStopProxies(
  events: PlayEvent[],
  teamId: string,
): TeamRunStopProxies {
  let tackles = 0;
  let tfl = 0;
  let qbHits = 0;

  for (const event of events) {
    if (event.defenseTeamId !== teamId) continue;

    // Rush / fumble on a rush play: one defender finished the carry,
    // so book it as a team tackle. Stuffs (yardage < 1) additionally
    // count as a TFL.
    const isRunConcept = RUN_CONCEPTS.has(event.call.concept);
    if (
      isRunConcept &&
      (event.outcome === "rush" || event.outcome === "fumble")
    ) {
      tackles++;
      if (event.yardage < TFL_YARDAGE_THRESHOLD) {
        tfl++;
      }
      continue;
    }

    // Non-sack pass play with a `pressure` tag counts as a team QB hit
    // proxy. Sacks already have their own attribution path below, so
    // don't double-count them here.
    const hasPressure = event.tags.includes("pressure");
    const isSack = event.outcome === "sack" || event.tags.includes("sack");
    if (hasPressure && !isSack) {
      qbHits++;
    }
  }

  return { tackles, tfl, qb_hits: qbHits };
}

function countIdlSacks(events: PlayEvent[], idlPlayerId: string): number {
  let sacks = 0;
  for (const event of events) {
    if (event.outcome !== "sack" && !event.tags.includes("sack")) continue;
    for (const participant of event.participants) {
      if (
        participant.playerId === idlPlayerId &&
        participant.tags.includes("sack")
      ) {
        sacks++;
        break;
      }
    }
  }
  return sacks;
}

export interface IdlSampleInput {
  game: GameResult;
  home: SimTeam;
  away: SimTeam;
}

export function collectIdlSamples(input: IdlSampleInput): IdlGameSample[] {
  const { game, home, away } = input;
  const samples: IdlGameSample[] = [];

  for (const team of [home, away]) {
    const starterIdls = team.starters.filter(
      (p) => p.neutralBucket === "IDL",
    );
    if (starterIdls.length === 0) continue;

    const teamProxies = teamRunStopProxies(game.events, team.teamId);
    const split = starterIdls.length;

    for (const starter of starterIdls) {
      const sacks = countIdlSacks(game.events, starter.playerId);
      const tackles = teamProxies.tackles / split;
      const tfl = teamProxies.tfl / split;
      const qbHits = teamProxies.qb_hits / split;

      samples.push({
        teamId: team.teamId,
        idlPlayerId: starter.playerId,
        idlOverall: idlOverall(starter.attributes),
        sacks,
        qb_hits: qbHits,
        tfl,
        tackles,
        // Each sample spans exactly one game so per-game rates equal
        // the raw counts. Keeping the _per_game fields aligns the
        // sample schema with the NFL band fixture keys.
        sacks_per_game: sacks,
        qb_hits_per_game: qbHits,
        tfl_per_game: tfl,
        tackles_per_game: tackles,
      });
    }
  }

  return samples;
}
