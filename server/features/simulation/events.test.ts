import { assertExists } from "@std/assert";
import type {
  BoxScore,
  DefensiveCall,
  DriveSummary,
  GameResult,
  InjuryEntry,
  OffensiveCall,
  PlayEvent,
  PlayOutcome,
  PlayParticipant,
  PlayTag,
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
      boxScore: {} as BoxScore,
      driveLog: [] as DriveSummary[],
      injuryReport: [] as InjuryEntry[],
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
    ];
    assertExists(tags);
  });
});
