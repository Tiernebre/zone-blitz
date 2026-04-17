import type { GameResult, PlayEvent } from "../../events.ts";
import type { SimTeam } from "../../simulate-game.ts";
import type { PlayerRuntime } from "../../resolve-play.ts";
import { edgeOverall } from "./edge-overall.ts";

export interface EdgeGameSample {
  teamId: string;
  edgePlayerId: string;
  edgeOverall: number;
  games: number;
  sacks: number;
  qb_hits: number;
  tfl: number;
  sacks_per_game: number;
  qb_hits_per_game: number;
  tfl_per_game: number;
}

// Accumulate per-defense-team event counts needed to allocate EDGE
// stats. The sim engine logs the rushing defender as a participant on
// sacks (with a `sack` tag on the participant), but NOT on "pressure"
// events (pressure is a play-level tag without a defender attribution)
// and it does not emit a tackle-for-loss concept at all. This helper
// gives us the raw counts we need to split across EDGE starters below.
interface DefenseAggregates {
  sackParticipantByPlayerId: Map<string, number>;
  teamPressures: number;
}

function aggregateDefense(
  events: PlayEvent[],
  defenseTeamId: string,
): DefenseAggregates {
  const sackParticipantByPlayerId = new Map<string, number>();
  let teamPressures = 0;

  for (const event of events) {
    if (event.defenseTeamId !== defenseTeamId) continue;

    if (event.outcome === "sack") {
      for (const p of event.participants) {
        if (p.tags.includes("sack")) {
          sackParticipantByPlayerId.set(
            p.playerId,
            (sackParticipantByPlayerId.get(p.playerId) ?? 0) + 1,
          );
        }
      }
    }

    // `pressure` is a play-level tag the engine adds on sacks and on
    // pass plays where the pass-rush overwhelmed protection. It's the
    // best signal we have for a QB-hit proxy since the engine does
    // not emit a dedicated qb_hit event. See PROXY METRICS note in
    // per-position-edge.R for the full gap.
    if (event.tags.includes("pressure")) {
      teamPressures++;
    }
  }

  return { sackParticipantByPlayerId, teamPressures };
}

export interface EdgeSampleInput {
  game: GameResult;
  home: SimTeam;
  away: SimTeam;
}

// ============================================================================
// EDGE-sample attribution — proxy, v1 per issue #496.
// ----------------------------------------------------------------------------
// The engine's per-play logging is asymmetric for defensive play:
//   - Sacks are attributed to a specific defender (participant with
//     `sack` tag) — we credit those directly.
//   - QB hits are NOT emitted. We proxy them as team-level `pressure`
//     tags, then split across the team's EDGE starters weighted by
//     passRushing (shares > 0 only). This loses the individual signal
//     an NFL qb_hit carries but preserves the team-total magnitude so
//     band checks remain comparable to NFL per-game means.
//   - Tackles-for-loss aren't emitted at all. We report 0 and flag
//     it; the band check will fail low on every EDGE bucket, which is
//     the calibration report's job — surface the gap.
//
// Follow-up (tracked as an issue once this slice merges): add a
// `qb_hit` participant tag to synthesize-pass-outcome and a `tfl`
// tag to synthesize-run-outcome, then swap this allocation for
// direct per-player attribution.
// ============================================================================
export function collectEdgeSamples(
  input: EdgeSampleInput,
): EdgeGameSample[] {
  const { game, home, away } = input;

  const samples: EdgeGameSample[] = [];
  for (const team of [home, away]) {
    const edges = team.starters.filter(
      (p: PlayerRuntime) => p.neutralBucket === "EDGE",
    );
    if (edges.length === 0) continue;

    const agg = aggregateDefense(game.events, team.teamId);

    const totalPassRushing = edges.reduce(
      (sum, e) => sum + (e.attributes.passRushing ?? 0),
      0,
    );

    for (const edge of edges) {
      const sacks = agg.sackParticipantByPlayerId.get(edge.playerId) ?? 0;

      // Split team pressures proportional to passRushing. If every
      // starter has 0 passRushing (defensive test data), fall back to
      // even split so we still generate a non-degenerate sample.
      const share = totalPassRushing > 0
        ? (edge.attributes.passRushing ?? 0) / totalPassRushing
        : 1 / edges.length;
      const qbHits = agg.teamPressures * share;

      const tfl = 0;

      samples.push({
        teamId: team.teamId,
        edgePlayerId: edge.playerId,
        edgeOverall: edgeOverall(edge.attributes),
        games: 1,
        sacks,
        qb_hits: qbHits,
        tfl,
        sacks_per_game: sacks,
        qb_hits_per_game: qbHits,
        tfl_per_game: tfl,
      });
    }
  }
  return samples;
}
