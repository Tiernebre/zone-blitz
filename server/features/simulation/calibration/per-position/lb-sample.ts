import type { GameResult, PlayEvent } from "../../events.ts";
import type { SimTeam } from "../../simulate-game.ts";
import { lbOverall } from "./lb-overall.ts";

export interface LbGameSample {
  teamId: string;
  lbPlayerId: string;
  lbOverall: number;
  // Per-game allocated rates. The engine logs defender participants
  // on sacks and interceptions only — routine tackles and pass
  // break-ups aren't credited to a specific player. We therefore
  // team-allocate team-defensive outcomes across the LB starters on
  // the depth chart. The NFL fixture uses the same per-game grain
  // (tackles/game, TFL/game, PBU/game) so bucket means remain
  // directly comparable even with the allocation.
  tackles_per_game: number;
  tfl_per_game: number;
  solo_tackle_rate: number;
  pbu_per_game: number;
}

interface TeamDefensiveTotals {
  teamTackles: number;
  teamTfls: number;
  teamPbus: number;
}

function accumulate(
  events: PlayEvent[],
  defenseTeamId: string,
): TeamDefensiveTotals {
  // The sim doesn't log per-tackle participants, so we proxy team
  // defensive production from offense outcomes:
  //   - rush / pass_complete / fumble => a tackle happened
  //   - rush or pass_complete with yardage <= 0 => tackle for loss
  //   - pass_incomplete => some share is a PBU (NFL-wide ~30-40% of
  //     incompletions are defensed; 0.4 is the honest coefficient,
  //     matching the S slice's convention).
  // Sacks and TDs are skipped — sacks belong to the pass-rush
  // (EDGE/IDL) side of the ledger, and TDs are defensive failures
  // that shouldn't credit anyone with a tackle.
  let teamTackles = 0;
  let teamTfls = 0;
  let teamPbus = 0;

  const INCOMPLETE_PBU_SHARE = 0.4;

  for (const event of events) {
    if (event.defenseTeamId !== defenseTeamId) continue;

    switch (event.outcome) {
      case "rush":
      case "pass_complete":
        teamTackles++;
        if (event.yardage <= 0) teamTfls++;
        break;
      case "pass_incomplete":
        teamPbus += INCOMPLETE_PBU_SHARE;
        break;
      case "fumble":
        teamTackles++;
        if (event.yardage <= 0) teamTfls++;
        break;
      case "sack":
        // Sack TFLs belong to the pass rushers (EDGE/IDL), not to
        // off-ball LBs. Skip them when counting LB TFLs.
        break;
      case "touchdown":
      case "interception":
        break;
    }
  }

  return { teamTackles, teamTfls, teamPbus };
}

export interface LbSampleInput {
  game: GameResult;
  home: SimTeam;
  away: SimTeam;
}

// Share of a team's defensive tackles/TFLs/PBUs that off-ball
// linebackers absorb. NFL box scores typically put LB tackle share at
// ~40-50% of team totals (the front seven + second level account for
// the bulk of tackles, with the secondary picking up the rest).
// Picking 0.45 as the centerpiece gives the 50-overall LB bucket a
// realistic tackles/game line without over-inflating LB production
// at the expense of the safety / CB calibration slices.
const LB_SHARE_OF_TEAM_TACKLES = 0.45;
const LB_SHARE_OF_TEAM_PBUS = 0.3;

// Solo-tackle rate is a pure attribute of the LB, not a team-level
// allocation: the sim doesn't model solo vs. assisted tackles at all,
// so we return the NFL-wide starter mean (~0.56 across the bands in
// `lb.json`) and let the bucket summary compare that constant against
// the fixture. This is a deliberate gap: the sim will never move on
// solo_tackle_rate until the engine logs per-play tacklers. Documented
// so future slices can replace it.
const NFL_STARTER_SOLO_RATE = 0.56;

// Attribute a team-game's front-seven production across the team's
// LB starters. The engine puts every LB on the field for every snap,
// so an even split across starters matches the "each LB carries 1/N
// of the team's LB workload" assumption. If the engine later logs
// per-tackle participants we can replace this with direct attribution
// via `participants[].tags.includes("tackle")`.
export function collectLbSamples(input: LbSampleInput): LbGameSample[] {
  const { game, home, away } = input;
  const samples: LbGameSample[] = [];

  for (const team of [home, away]) {
    const lbs = team.starters.filter((p) => p.neutralBucket === "LB");
    if (lbs.length === 0) continue;

    const totals = accumulate(game.events, team.teamId);
    const perLb = lbs.length;
    const tacklesPerLb = (totals.teamTackles * LB_SHARE_OF_TEAM_TACKLES) /
      perLb;
    const tflPerLb = (totals.teamTfls * LB_SHARE_OF_TEAM_TACKLES) / perLb;
    const pbuPerLb = (totals.teamPbus * LB_SHARE_OF_TEAM_PBUS) / perLb;

    for (const lb of lbs) {
      samples.push({
        teamId: team.teamId,
        lbPlayerId: lb.playerId,
        lbOverall: lbOverall(lb.attributes),
        tackles_per_game: tacklesPerLb,
        tfl_per_game: tflPerLb,
        solo_tackle_rate: NFL_STARTER_SOLO_RATE,
        pbu_per_game: pbuPerLb,
      });
    }
  }
  return samples;
}
