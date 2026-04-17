import type { GameResult, PlayEvent } from "../../events.ts";
import type { SimTeam } from "../../simulate-game.ts";
import { sOverall } from "./s-overall.ts";

export interface SGameSample {
  teamId: string;
  safetyPlayerId: string;
  sOverall: number;
  // Per-game allocated rates. The engine currently only logs a
  // defender participant on sacks / interceptions / return TDs, so
  // tackles and pass-break-ups can't be attributed to a specific
  // safety. We instead team-allocate team-game defensive outcomes
  // across the `S` starters on the depth chart: each starter gets an
  // equal share of the team's allocated-to-secondary events. The NFL
  // fixture uses the same per-game grain (tackles/game, INT/game,
  // etc.) so the bucket means stay directly comparable.
  tackles_per_game: number;
  int_rate: number;
  pbu_rate: number;
  forced_fumble_rate: number;
}

interface TeamDefensiveTotals {
  teamTackles: number;
  teamInts: number;
  teamPbus: number;
  teamForcedFumbles: number;
}

function accumulate(
  events: PlayEvent[],
  defenseTeamId: string,
): TeamDefensiveTotals {
  // Tackles and PBUs aren't per-play logged, so we proxy them from
  // the team-facing offense outcomes: every run-concept ball carrier
  // gets tackled (except on TDs), and every incomplete pass is
  // (roughly) either a broken-up ball or an off-target throw. We
  // split incompletes 50/50 between "PBU" and "throwaway/misfire" —
  // NFL-wide PBU rate on incompletes sits ~30-40%, so 0.4 is the
  // honest coefficient. Tackles count every offense play that ended
  // short of the endzone and wasn't a sack (which the DL already
  // owns) or an out-of-bounds pass (folded into the 60% incomplete).
  let teamTackles = 0;
  let teamInts = 0;
  let teamPbus = 0;
  let teamForcedFumbles = 0;

  const INCOMPLETE_PBU_SHARE = 0.4;

  for (const event of events) {
    if (event.defenseTeamId !== defenseTeamId) continue;

    switch (event.outcome) {
      case "rush":
      case "pass_complete":
        teamTackles++;
        break;
      case "pass_incomplete":
        teamPbus += INCOMPLETE_PBU_SHARE;
        break;
      case "interception":
        teamInts++;
        break;
      case "fumble":
        teamForcedFumbles++;
        teamTackles++;
        break;
      case "touchdown":
        // Defense didn't make a stop on an offense TD — skip.
        break;
      case "sack":
        // Sacks are pass-rush credit, not a safety tackle. Skip.
        break;
    }
  }

  return { teamTackles, teamInts, teamPbus, teamForcedFumbles };
}

export interface SSampleInput {
  game: GameResult;
  home: SimTeam;
  away: SimTeam;
}

// Attribute a team-game's secondary production across the team's S
// starters. The engine's `resolve-matchups.ts` puts both S starters on
// the field together (deep/box split), so they share coverage and
// run-support work — an even split is the honest first-pass
// attribution until the engine logs per-play defenders on routine
// coverage/tackle events.
export function collectSSamples(input: SSampleInput): SGameSample[] {
  const { game, home, away } = input;
  const samples: SGameSample[] = [];

  for (const team of [home, away]) {
    const safeties = team.starters.filter((p) => p.neutralBucket === "S");
    if (safeties.length === 0) continue;

    const totals = accumulate(game.events, team.teamId);
    // Safeties account for roughly half the secondary's production —
    // corners own the other half. Splitting team tackles evenly
    // across S + CB starters would over-credit safeties in tackling
    // (CBs tackle plenty) so we apportion the secondary's share at
    // `SECONDARY_SHARE_OF_TEAM` of team defensive events. This is a
    // deliberate simplification documented so future slices can
    // replace it with a per-play defender-logging attribution.
    const SECONDARY_SHARE_OF_TEAM = 0.45;
    const perSafety = safeties.length;

    for (const s of safeties) {
      samples.push({
        teamId: team.teamId,
        safetyPlayerId: s.playerId,
        sOverall: sOverall(s.attributes),
        tackles_per_game: (totals.teamTackles * SECONDARY_SHARE_OF_TEAM) /
          perSafety,
        int_rate: (totals.teamInts * SECONDARY_SHARE_OF_TEAM) / perSafety,
        pbu_rate: (totals.teamPbus * SECONDARY_SHARE_OF_TEAM) / perSafety,
        forced_fumble_rate:
          (totals.teamForcedFumbles * SECONDARY_SHARE_OF_TEAM) / perSafety,
      });
    }
  }
  return samples;
}
