import { assertExists } from "@std/assert";
import type {
  BoxScore,
  DefensiveCall,
  DriveResult,
  DriveSummary,
  GameResult,
  InjuryEntry,
  InjurySeverity,
  OffensiveCall,
  PlayEvent,
  PlayOutcome,
  PlayParticipant,
  PlayTag,
  TeamBoxScore,
} from "./events.ts";

Deno.test("PlayEvent types", async (t) => {
  await t.step("PlayEvent carries all required fields", () => {
    const event: PlayEvent = {
      gameId: "game-1",
      driveIndex: 0,
      playIndex: 0,
      quarter: 1,
      clock: "15:00",
      situation: { down: 1, distance: 10, yardLine: 25 },
      offenseTeamId: "team-a",
      defenseTeamId: "team-b",
      call: {
        concept: "inside_zone",
        personnel: "11",
        formation: "shotgun",
        motion: "none",
      },
      coverage: { front: "4-3", coverage: "cover_3", pressure: "base" },
      participants: [{
        role: "ballcarrier",
        playerId: "p1",
        tags: ["rush_attempt"],
      }],
      outcome: "rush",
      yardage: 5,
      tags: ["first_down"],
    };
    assertExists(event);
  });

  await t.step("PlayEvent quarter supports OT", () => {
    const event: PlayEvent = {
      gameId: "game-1",
      driveIndex: 0,
      playIndex: 0,
      quarter: "OT",
      clock: "10:00",
      situation: { down: 1, distance: 10, yardLine: 50 },
      offenseTeamId: "team-a",
      defenseTeamId: "team-b",
      call: {
        concept: "hb_draw",
        personnel: "12",
        formation: "i_form",
        motion: "none",
      },
      coverage: { front: "3-4", coverage: "cover_2", pressure: "blitz" },
      participants: [],
      outcome: "rush",
      yardage: 3,
      tags: [],
    };
    assertExists(event);
  });

  await t.step("GameResult carries all required fields", () => {
    const result: GameResult = {
      gameId: "game-1",
      seed: 42,
      finalScore: { home: 24, away: 17 },
      events: [],
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
    assertExists(result);
  });

  await t.step(
    "OffensiveCall has concept, personnel, formation, motion",
    () => {
      const call: OffensiveCall = {
        concept: "pa_boot",
        personnel: "11",
        formation: "spread",
        motion: "jet",
      };
      assertExists(call);
    },
  );

  await t.step("DefensiveCall has front, coverage, pressure", () => {
    const call: DefensiveCall = {
      front: "nickel",
      coverage: "cover_1",
      pressure: "zone_blitz",
    };
    assertExists(call);
  });

  await t.step("PlayParticipant has role, playerId, tags", () => {
    const participant: PlayParticipant = {
      role: "passer",
      playerId: "qb-1",
      tags: ["completion", "pressure"],
    };
    assertExists(participant);
  });

  await t.step("PlayOutcome covers expected values", () => {
    const outcomes: PlayOutcome[] = [
      "rush",
      "pass_complete",
      "pass_incomplete",
      "sack",
      "interception",
      "fumble",
      "touchdown",
      "field_goal",
      "punt",
      "penalty",
      "kneel",
      "spike",
    ];
    assertExists(outcomes);
  });

  await t.step("PlayTag covers expected values", () => {
    const tags: PlayTag[] = [
      "first_down",
      "turnover",
      "big_play",
      "injury",
      "penalty",
      "touchdown",
      "safety",
      "two_point_conversion",
      "sack",
      "pressure",
      "interception",
      "fumble",
      "fumble_recovery",
      "injury_shake_off",
      "injury_miss_drive",
      "injury_miss_quarter",
      "injury_miss_game",
      "injury_miss_weeks",
      "injury_miss_season",
      "injury_career_ending",
    ];
    assertExists(tags);
  });

  await t.step("InjurySeverity covers all tiers", () => {
    const severities: InjurySeverity[] = [
      "shake_off",
      "miss_drive",
      "miss_quarter",
      "miss_game",
      "miss_weeks",
      "miss_season",
      "career_ending",
    ];
    assertExists(severities);
  });

  await t.step("InjuryEntry has structured fields", () => {
    const entry: InjuryEntry = {
      playerId: "p1",
      playIndex: 5,
      driveIndex: 2,
      quarter: 2,
      severity: "miss_drive",
    };
    assertExists(entry);
  });

  await t.step("DriveSummary has structured fields", () => {
    const drive: DriveSummary = {
      driveIndex: 0,
      offenseTeamId: "team-a",
      startYardLine: 25,
      plays: 8,
      yards: 75,
      result: "touchdown",
    };
    assertExists(drive);
  });

  await t.step("DriveResult covers expected values", () => {
    const results: DriveResult[] = [
      "touchdown",
      "field_goal",
      "punt",
      "turnover",
      "turnover_on_downs",
      "end_of_half",
      "safety",
    ];
    assertExists(results);
  });

  await t.step("TeamBoxScore has team stat fields", () => {
    const stats: TeamBoxScore = {
      totalYards: 350,
      passingYards: 250,
      rushingYards: 100,
      turnovers: 2,
      sacks: 3,
      penalties: 5,
    };
    assertExists(stats);
  });

  await t.step("BoxScore has home and away", () => {
    const box: BoxScore = {
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
    };
    assertExists(box);
  });
});
