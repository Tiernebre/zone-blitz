import type { GameResult, PlayEvent } from "../../events.ts";
import type { SimTeam } from "../../simulate-game.ts";
import type { PlayerRuntime } from "../../resolve-play.ts";
import { wrOverall } from "./wr-overall.ts";

export interface WrGameSample {
  teamId: string;
  wrPlayerId: string;
  wrOverall: number;
  // Target-share weight used to split team pass stats across starter
  // WRs (routeRunning / sum(routeRunning for starter WRs on this team)).
  targetShare: number;
  targets: number;
  receptions: number;
  rec_yards: number;
  rec_tds: number;
  catch_rate: number;
  yards_per_reception: number;
  yards_per_target: number;
  td_rate: number;
  yards_per_game: number;
}

const RUN_CONCEPTS = new Set([
  "inside_zone",
  "outside_zone",
  "power",
  "counter",
  "draw",
  "rpo",
]);

interface TeamPassTotals {
  targets: number;
  receptions: number;
  rec_yards: number;
  rec_tds: number;
}

function accumulateTeamPassing(
  events: PlayEvent[],
  teamId: string,
): TeamPassTotals {
  let targets = 0;
  let receptions = 0;
  let recYards = 0;
  let recTds = 0;

  for (const event of events) {
    if (event.offenseTeamId !== teamId) continue;

    switch (event.outcome) {
      case "pass_complete":
        targets++;
        receptions++;
        recYards += event.yardage;
        break;
      case "pass_incomplete":
        targets++;
        break;
      case "interception":
        // Pick-sixes still count as a target even though there's no
        // reception — mirrors how the QB sample treats interceptions
        // as dropbacks.
        targets++;
        break;
      case "touchdown":
        // Pass-concept TDs are completed passes to a receiver. Run
        // concept TDs belong to the ball carrier (see RB sample).
        if (!RUN_CONCEPTS.has(event.call.concept)) {
          targets++;
          receptions++;
          recYards += event.yardage;
          recTds++;
        }
        break;
    }
  }

  return {
    targets,
    receptions,
    rec_yards: recYards,
    rec_tds: recTds,
  };
}

export interface WrSampleInput {
  game: GameResult;
  home: SimTeam;
  away: SimTeam;
}

// Attribute a team-game's pass-catching stats across the team's starter
// WRs. The engine's `resolve-matchups.ts` does not log the targeted
// receiver on every pass-incomplete, so we can't read per-WR stats
// directly from events. Instead we split team pass totals by
// routeRunning-weighted target share, which mirrors how defenders
// allocate attention across routes in the real game: a WR with a
// higher routeRunning rating draws a larger slice of the team's
// targets. TEs are excluded from the split because they have their
// own position bucket and will get their own calibration harness.
export function collectWrSamples(input: WrSampleInput): WrGameSample[] {
  const { game, home, away } = input;

  const samples: WrGameSample[] = [];
  for (const team of [home, away]) {
    const wrs = team.starters.filter(
      (p: PlayerRuntime) => p.neutralBucket === "WR",
    );
    if (wrs.length === 0) continue;

    const routeWeights = wrs.map((p) => p.attributes.routeRunning);
    const totalWeight = routeWeights.reduce((a, b) => a + b, 0);
    const teamTotals = accumulateTeamPassing(game.events, team.teamId);

    for (let i = 0; i < wrs.length; i++) {
      const wr = wrs[i];
      // If every starter WR is rated 0 somehow, fall back to an equal
      // split so we never divide by zero and every WR still emits a
      // sample that can be bucketed.
      const share = totalWeight > 0
        ? routeWeights[i] / totalWeight
        : 1 / wrs.length;

      const targets = teamTotals.targets * share;
      const receptions = teamTotals.receptions * share;
      const recYards = teamTotals.rec_yards * share;
      const recTds = teamTotals.rec_tds * share;

      samples.push({
        teamId: team.teamId,
        wrPlayerId: wr.playerId,
        wrOverall: wrOverall(wr.attributes),
        targetShare: share,
        targets,
        receptions,
        rec_yards: recYards,
        rec_tds: recTds,
        catch_rate: targets > 0 ? receptions / targets : 0,
        yards_per_reception: receptions > 0 ? recYards / receptions : 0,
        yards_per_target: targets > 0 ? recYards / targets : 0,
        td_rate: targets > 0 ? recTds / targets : 0,
        // One sample spans a single game, so `yards_per_game` is just
        // this WR's share of the team's receiving yards.
        yards_per_game: recYards,
      });
    }
  }
  return samples;
}
