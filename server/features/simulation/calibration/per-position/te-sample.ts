import type { GameResult, PlayEvent } from "../../events.ts";
import type { SimTeam } from "../../simulate-game.ts";
import { teOverall } from "./te-overall.ts";

export interface TeGameSample {
  teamId: string;
  tePlayerId: string;
  teOverall: number;
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

function accumulate(
  events: PlayEvent[],
  teamId: string,
  tePlayerId: string,
) {
  let targets = 0;
  let receptions = 0;
  let recYards = 0;
  let recTds = 0;

  for (const event of events) {
    if (event.offenseTeamId !== teamId) continue;
    if (RUN_CONCEPTS.has(event.call.concept)) continue;

    const participant = event.participants.find(
      (p) => p.playerId === tePlayerId && p.tags.includes("target"),
    );
    if (!participant) continue;

    switch (event.outcome) {
      case "pass_complete":
        targets++;
        receptions++;
        recYards += event.yardage;
        break;
      case "touchdown":
        // A pass-concept TD's participant carries both "target" and
        // "reception" tags (pass_complete gets upgraded to touchdown
        // in `resolve-play.ts`). Count it as a target + reception
        // worth the event yardage, with a receiving TD credited to
        // the TE.
        targets++;
        receptions++;
        recYards += event.yardage;
        recTds++;
        break;
      case "pass_incomplete":
        // Engine tags the intended target even on incompletions via
        // the `target` tag at the pass-outcome layer; we still count
        // it as a target, but no reception / yards.
        targets++;
        break;
      case "interception":
        // An INT on a pass aimed at the TE also counts as a target
        // (it was their route) with zero yards — mirrors how NFL
        // target counts work for receivers.
        targets++;
        break;
    }
  }

  // NOTE / gap: the engine currently tags "target" on pass_complete
  // and upgraded-to-touchdown outcomes (see `synthesize-pass-outcome.ts`).
  // Pass_incomplete and interception outcomes do NOT carry a `target`
  // tag today, so those branches above will almost never fire — the
  // TE calibration effectively measures catch rate as ~100% on the
  // subset of plays that were flagged as TE receptions. Fixing this
  // without touching shared engine code is out of scope for this
  // slice; the calibration report will surface the mismatch against
  // NFL catch-rate bands (~0.62–0.77) and we'll file a follow-up to
  // teach the engine to tag the intended target on every pass play.
  return {
    targets,
    receptions,
    rec_yards: recYards,
    rec_tds: recTds,
    catch_rate: targets > 0 ? receptions / targets : 0,
    yards_per_reception: receptions > 0 ? recYards / receptions : 0,
    yards_per_target: targets > 0 ? recYards / targets : 0,
    td_rate: targets > 0 ? recTds / targets : 0,
    // One sample covers a single game, so yards_per_game is simply
    // the receiving yardage for this game — keeps the metric name
    // aligned with the NFL band fixture so bucket means are
    // directly comparable.
    yards_per_game: recYards,
  };
}

export interface TeSampleInput {
  game: GameResult;
  home: SimTeam;
  away: SimTeam;
}

// Attribute a team-game's TE receiving stats to the team's starter
// TE. Real offenses rotate multiple TEs in 12/13-personnel packages,
// but the calibration league's starter TE takes every TE route of
// consequence — and calibration injuries are rare enough that backups
// don't meaningfully shift per-bucket means. If a team starts no TE
// (nominally one-TE personnel only), we skip it.
export function collectTeSamples(input: TeSampleInput): TeGameSample[] {
  const { game, home, away } = input;

  const samples: TeGameSample[] = [];
  for (const team of [home, away]) {
    const te = team.starters.find((p) => p.neutralBucket === "TE");
    if (!te) continue;

    const stats = accumulate(game.events, team.teamId, te.playerId);
    samples.push({
      teamId: team.teamId,
      tePlayerId: te.playerId,
      teOverall: teOverall(te.attributes),
      ...stats,
    });
  }
  return samples;
}
