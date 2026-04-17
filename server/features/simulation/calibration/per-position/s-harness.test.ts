import { assertEquals, assertStringIncludes } from "@std/assert";
import type { PlayerAttributes } from "@zone-blitz/shared";
import { formatSCalibrationReport, runSCalibration } from "./s-harness.ts";
import type { GameResult, PlayEvent } from "../../events.ts";
import type { SimTeam } from "../../simulate-game.ts";
import type { PlayerRuntime } from "../../resolve-play.ts";
import type { CalibrationLeague } from "../generate-calibration-league.ts";

function attrs(overrides: Partial<PlayerAttributes> = {}): PlayerAttributes {
  const base: Record<string, number> = {};
  const keys = [
    "speed",
    "acceleration",
    "agility",
    "strength",
    "jumping",
    "stamina",
    "durability",
    "armStrength",
    "accuracyShort",
    "accuracyMedium",
    "accuracyDeep",
    "accuracyOnTheRun",
    "touch",
    "release",
    "ballCarrying",
    "elusiveness",
    "routeRunning",
    "catching",
    "contestedCatching",
    "runAfterCatch",
    "passBlocking",
    "runBlocking",
    "blockShedding",
    "tackling",
    "manCoverage",
    "zoneCoverage",
    "passRushing",
    "runDefense",
    "kickingPower",
    "kickingAccuracy",
    "puntingPower",
    "puntingAccuracy",
    "snapAccuracy",
    "footballIq",
    "decisionMaking",
    "anticipation",
    "composure",
    "clutch",
    "consistency",
    "workEthic",
    "coachability",
    "leadership",
    "greed",
    "loyalty",
    "ambition",
    "vanity",
    "schemeAttachment",
    "mediaSensitivity",
  ];
  for (const k of keys) {
    base[k] = 50;
    base[`${k}Potential`] = 50;
  }
  return { ...(base as unknown as PlayerAttributes), ...overrides };
}

function safetyRuntime(id: string, overall: number): PlayerRuntime {
  return {
    playerId: id,
    neutralBucket: "S",
    attributes: attrs({
      zoneCoverage: overall,
      manCoverage: overall,
      speed: overall,
      tackling: overall,
      anticipation: overall,
    }),
  };
}

function team(teamId: string, starters: PlayerRuntime[]): SimTeam {
  return {
    teamId,
    starters,
    bench: [],
    fingerprint: { offense: null, defense: null, overrides: {} },
    coachingMods: {
      schemeFitBonus: 0,
      situationalBonus: 0,
      aggressiveness: 50,
      penaltyDiscipline: 1,
    },
  };
}

function bandJson(): string {
  // Band means are chosen so the default 30↔replacement, 40↔weak,
  // 50↔average, 60↔good, 70/80↔elite mapping sorts monotonically and
  // each bucket lands in its target band in the stub scenario below.
  const band = (scale: number) => ({
    n: 20,
    metrics: {
      tackles_per_game: { n: 20, mean: 3 + scale, sd: 1 },
      int_rate: { n: 20, mean: 0.05 + 0.03 * scale, sd: 0.02 },
      pbu_rate: { n: 20, mean: 0.2 + 0.1 * scale, sd: 0.05 },
      forced_fumble_rate: { n: 20, mean: 0.02 + 0.01 * scale, sd: 0.01 },
    },
  });
  return JSON.stringify({
    position: "S",
    seasons: [2020, 2021, 2022, 2023, 2024],
    ranking_stat: "playmaker_per_game",
    bands: {
      elite: band(2),
      good: band(1.5),
      average: band(1),
      weak: band(0.5),
      replacement: band(0),
    },
  });
}

function makeGame(
  gameId: string,
  homeTeamId: string,
  awayTeamId: string,
  // Per-team rates of rushes/completes/incompletes/INTs/fumbles to
  // emit. The harness divides by S starter count + secondary share,
  // so these team totals flow straight through.
  events: Record<string, {
    rushes: number;
    completes: number;
    incompletes: number;
    ints: number;
    fumbles: number;
  }>,
): GameResult {
  const out: PlayEvent[] = [];
  const idx = { i: 0 };
  function push(
    offenseTeamId: string,
    defenseTeamId: string,
    outcome: PlayEvent["outcome"],
  ) {
    out.push({
      gameId,
      driveIndex: 0,
      playIndex: idx.i++,
      quarter: 1,
      clock: "15:00",
      situation: { down: 1, distance: 10, yardLine: 25 },
      offenseTeamId,
      defenseTeamId,
      call: {
        concept: "dropback",
        personnel: "11",
        formation: "shotgun",
        motion: "none",
      },
      coverage: { front: "4-3", coverage: "cover_2", pressure: "four_man" },
      participants: [],
      outcome,
      yardage: outcome === "pass_complete" || outcome === "rush" ? 5 : 0,
      tags: [],
    });
  }
  for (const [defenseTeamId, rates] of Object.entries(events)) {
    const offenseTeamId = defenseTeamId === homeTeamId
      ? awayTeamId
      : homeTeamId;
    for (let i = 0; i < rates.rushes; i++) {
      push(offenseTeamId, defenseTeamId, "rush");
    }
    for (let i = 0; i < rates.completes; i++) {
      push(offenseTeamId, defenseTeamId, "pass_complete");
    }
    for (let i = 0; i < rates.incompletes; i++) {
      push(offenseTeamId, defenseTeamId, "pass_incomplete");
    }
    for (let i = 0; i < rates.ints; i++) {
      push(offenseTeamId, defenseTeamId, "interception");
    }
    for (let i = 0; i < rates.fumbles; i++) {
      push(offenseTeamId, defenseTeamId, "fumble");
    }
  }
  return {
    gameId,
    seed: 1,
    finalScore: { home: 0, away: 0 },
    events: out,
    boxScore: {
      home: {
        totalYards: 0,
        passingYards: 0,
        rushingYards: 0,
        turnovers: 0,
        sacks: 0,
        penalties: 0,
      },
      away: {
        totalYards: 0,
        passingYards: 0,
        rushingYards: 0,
        turnovers: 0,
        sacks: 0,
        penalties: 0,
      },
    },
    driveLog: [],
    injuryReport: [],
  };
}

Deno.test("runSCalibration runs the sim, buckets safeties, and returns a populated report", () => {
  // Build a league where each team's two S starters share an overall,
  // and the stub simulate emits per-team event totals that, once the
  // sample collector applies the 0.45 secondary share and divides
  // across 2 safeties, match the target band means.
  //
  // Band means for tackles_per_game are 3,3.5,4,4.5,5 for
  // replacement..elite. To land in the "average" band (4.0 tackles/g),
  // with 2 S starters, we need 2 * 4 / 0.45 ≈ 17.8 team tackles (≈ 18).
  const teams: SimTeam[] = [30, 40, 50, 60, 70, 80].map((overall) => {
    const id = `t${overall}`;
    return team(id, [
      safetyRuntime(`${id}-s1`, overall),
      safetyRuntime(`${id}-s2`, overall),
    ]);
  });
  const league: CalibrationLeague = { calibrationSeed: 1, teams };

  // For each defense team, emit enough tackles/INTs/PBUs/FFs that the
  // allocated per-safety rate targets the matching NFL band mean.
  const targetByOverall: Record<number, {
    tackles: number;
    ints: number;
    pbuInc: number;
    ff: number;
  }> = {
    30: { tackles: 3, ints: 0.05, pbuInc: 0.2, ff: 0.02 },
    40: { tackles: 3.5, ints: 0.08, pbuInc: 0.3, ff: 0.03 },
    50: { tackles: 4, ints: 0.11, pbuInc: 0.4, ff: 0.04 },
    60: { tackles: 4.5, ints: 0.14, pbuInc: 0.5, ff: 0.05 },
    70: { tackles: 5, ints: 0.17, pbuInc: 0.6, ff: 0.06 },
    80: { tackles: 5, ints: 0.17, pbuInc: 0.6, ff: 0.06 },
  };
  // sample.tackles_per_game = team_tackles * 0.45 / 2.
  // team_tackles = target * 2 / 0.45. Round because events are ints.
  const simulate = (
    { home, away, gameId }: {
      home: SimTeam;
      away: SimTeam;
      seed: number;
      gameId: string;
    },
  ) => {
    const per = (teamId: string) => {
      const overall = parseInt(teamId.replace("t", ""), 10);
      const tgt = targetByOverall[overall];
      const teamTackles = Math.round((tgt.tackles * 2) / 0.45);
      const teamInts = (tgt.ints * 2) / 0.45;
      const teamPbus = (tgt.pbuInc * 2) / 0.45;
      const teamFfs = (tgt.ff * 2) / 0.45;
      // Split team tackles 70/30 between rushes and completes so the
      // breakdown stays realistic; fumbles double-count as tackles so
      // subtract them here.
      const fumbles = Math.round(teamFfs);
      const rushes = Math.max(0, Math.round(teamTackles * 0.6) - fumbles);
      const completes = Math.max(
        0,
        teamTackles - rushes - fumbles,
      );
      const incompletes = Math.round(teamPbus / 0.4);
      return {
        rushes,
        completes,
        incompletes,
        ints: Math.round(teamInts),
        fumbles,
      };
    };
    return makeGame(gameId, home.teamId, away.teamId, {
      [home.teamId]: per(home.teamId),
      [away.teamId]: per(away.teamId),
    });
  };

  const report = runSCalibration({
    bandJson: bandJson(),
    league,
    simulate,
    gameCount: teams.length * 12,
    minSamplesPerBucket: 5,
  });

  assertEquals(report.totalGames, teams.length * 12);
  // Each matchup produces 2 teams × 2 S starters = 4 samples.
  assertEquals(report.totalSamples, report.totalGames * 4);

  const fifty = report.buckets.find((b) => b.bucketLabel === "50")!;
  assertEquals(fifty.samples > 0, true);
  assertEquals(fifty.underSampled, false);
  assertEquals(fifty.checks.length, 4);
  const tacklesCheck = fifty.checks.find((c) =>
    c.metricName === "tackles_per_game"
  )!;
  // Sim tackles/game for the 50-bucket should match the "average"
  // band mean (4.0) after allocation.
  assertEquals(tacklesCheck.expectedBand, "average");
});

Deno.test("runSCalibration marks a bucket under-sampled when below min threshold", () => {
  const teams: SimTeam[] = [
    team("t50", [safetyRuntime("t50-s1", 50), safetyRuntime("t50-s2", 50)]),
  ];
  const league: CalibrationLeague = { calibrationSeed: 1, teams };
  const simulate = (
    { home, away, gameId }: {
      home: SimTeam;
      away: SimTeam;
      seed: number;
      gameId: string;
    },
  ) =>
    makeGame(gameId, home.teamId, away.teamId, {
      [home.teamId]: {
        rushes: 10,
        completes: 5,
        incompletes: 8,
        ints: 1,
        fumbles: 0,
      },
      [away.teamId]: {
        rushes: 10,
        completes: 5,
        incompletes: 8,
        ints: 1,
        fumbles: 0,
      },
    });

  const report = runSCalibration({
    bandJson: bandJson(),
    league,
    simulate,
    gameCount: 1,
    minSamplesPerBucket: 100,
  });

  const fifty = report.buckets.find((b) => b.bucketLabel === "50")!;
  assertEquals(fifty.underSampled, true);
  assertEquals(fifty.checks.length, 0);
});

Deno.test("formatSCalibrationReport renders a human-readable summary", () => {
  const teams: SimTeam[] = [
    team("t50", [safetyRuntime("t50-s1", 50), safetyRuntime("t50-s2", 50)]),
  ];
  const league: CalibrationLeague = { calibrationSeed: 1, teams };
  const simulate = (
    { home, away, gameId }: {
      home: SimTeam;
      away: SimTeam;
      seed: number;
      gameId: string;
    },
  ) =>
    makeGame(gameId, home.teamId, away.teamId, {
      [home.teamId]: {
        rushes: 10,
        completes: 5,
        incompletes: 8,
        ints: 1,
        fumbles: 0,
      },
      [away.teamId]: {
        rushes: 10,
        completes: 5,
        incompletes: 8,
        ints: 1,
        fumbles: 0,
      },
    });

  const report = runSCalibration({
    bandJson: bandJson(),
    league,
    simulate,
    gameCount: 100,
    minSamplesPerBucket: 1,
  });
  const output = formatSCalibrationReport(report);
  assertStringIncludes(output, "S calibration");
  assertStringIncludes(output, "bucket 50");
  assertStringIncludes(output, "tackles_per_game");
});
