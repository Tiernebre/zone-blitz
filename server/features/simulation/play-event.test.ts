import { assertEquals } from "@std/assert";
import { buildPlayEvent } from "./play-event.ts";
import type { PlayEvent } from "./events.ts";

Deno.test("buildPlayEvent", async (t) => {
  const baseArgs = {
    gameId: "game-1",
    driveIndex: 2,
    playIndex: 5,
    quarter: 3 as const,
    clock: "8:30",
    situation: { down: 1 as const, distance: 10, yardLine: 25 },
    offenseTeamId: "team-a",
    defenseTeamId: "team-b",
    call: {
      concept: "inside_zone",
      personnel: "11",
      formation: "shotgun",
      motion: "none",
    },
    coverage: { front: "4-3", coverage: "cover_3", pressure: "base" },
    outcome: "rush" as const,
    yardage: 5,
    tags: ["first_down" as const],
    participants: [{
      role: "ballcarrier",
      playerId: "p1",
      tags: ["rush_attempt"],
    }],
  };

  await t.step("builds a PlayEvent with all required fields", () => {
    const event: PlayEvent = buildPlayEvent(baseArgs);

    assertEquals(event.gameId, "game-1");
    assertEquals(event.driveIndex, 2);
    assertEquals(event.playIndex, 5);
    assertEquals(event.quarter, 3);
    assertEquals(event.clock, "8:30");
    assertEquals(event.situation, { down: 1, distance: 10, yardLine: 25 });
    assertEquals(event.offenseTeamId, "team-a");
    assertEquals(event.defenseTeamId, "team-b");
    assertEquals(event.call.concept, "inside_zone");
    assertEquals(event.coverage.front, "4-3");
    assertEquals(event.outcome, "rush");
    assertEquals(event.yardage, 5);
    assertEquals(event.tags, ["first_down"]);
    assertEquals(event.participants.length, 1);
    assertEquals(event.participants[0].role, "ballcarrier");
  });

  await t.step("defaults participants to empty array when omitted", () => {
    const { participants: _, ...argsWithoutParticipants } = baseArgs;
    const event = buildPlayEvent(argsWithoutParticipants);
    assertEquals(event.participants, []);
  });

  await t.step("defaults tags to empty array when omitted", () => {
    const { tags: _, ...argsWithoutTags } = baseArgs;
    const event = buildPlayEvent(argsWithoutTags);
    assertEquals(event.tags, []);
  });

  await t.step("builds a field goal event", () => {
    const event = buildPlayEvent({
      gameId: "game-fg",
      driveIndex: 1,
      playIndex: 3,
      quarter: 2,
      clock: "0:05",
      situation: { down: 4, distance: 3, yardLine: 70 },
      offenseTeamId: "team-a",
      defenseTeamId: "team-b",
      call: {
        concept: "field_goal",
        personnel: "special_teams",
        formation: "field_goal",
        motion: "none",
      },
      coverage: {
        front: "field_goal_block",
        coverage: "none",
        pressure: "none",
      },
      outcome: "field_goal",
      yardage: 0,
      participants: [{ role: "kicker", playerId: "k1", tags: [] }],
    });

    assertEquals(event.outcome, "field_goal");
    assertEquals(event.call.concept, "field_goal");
    assertEquals(event.tags, []);
  });

  await t.step("builds a kneel event", () => {
    const event = buildPlayEvent({
      gameId: "game-kneel",
      driveIndex: 4,
      playIndex: 10,
      quarter: 4,
      clock: "0:40",
      situation: { down: 1, distance: 10, yardLine: 30 },
      offenseTeamId: "team-a",
      defenseTeamId: "team-b",
      call: {
        concept: "kneel",
        personnel: "victory",
        formation: "under_center",
        motion: "none",
      },
      coverage: {
        front: "victory",
        coverage: "none",
        pressure: "none",
      },
      outcome: "kneel",
      yardage: -1,
      tags: ["victory_formation"],
    });

    assertEquals(event.outcome, "kneel");
    assertEquals(event.yardage, -1);
    assertEquals(event.tags, ["victory_formation"]);
  });

  await t.step("builds a kickoff event", () => {
    const event = buildPlayEvent({
      gameId: "game-ko",
      driveIndex: 0,
      playIndex: 0,
      quarter: 1,
      clock: "15:00",
      situation: { down: 1, distance: 10, yardLine: 35 },
      offenseTeamId: "team-a",
      defenseTeamId: "team-b",
      call: {
        concept: "kickoff",
        personnel: "special_teams",
        formation: "kickoff",
        motion: "none",
      },
      coverage: {
        front: "kick_return",
        coverage: "none",
        pressure: "none",
      },
      outcome: "kickoff",
      yardage: 60,
      participants: [{ role: "kicker", playerId: "k1", tags: [] }],
    });

    assertEquals(event.outcome, "kickoff");
    assertEquals(event.yardage, 60);
  });

  await t.step("builds a punt event", () => {
    const event = buildPlayEvent({
      gameId: "game-punt",
      driveIndex: 3,
      playIndex: 7,
      quarter: 3,
      clock: "5:00",
      situation: { down: 4, distance: 8, yardLine: 30 },
      offenseTeamId: "team-a",
      defenseTeamId: "team-b",
      call: {
        concept: "punt",
        personnel: "special_teams",
        formation: "punt",
        motion: "none",
      },
      coverage: {
        front: "punt_return",
        coverage: "none",
        pressure: "none",
      },
      outcome: "punt",
      yardage: 45,
      tags: ["muff"],
      participants: [
        { role: "punter", playerId: "p1", tags: [] },
        { role: "returner", playerId: "r1", tags: [] },
      ],
    });

    assertEquals(event.outcome, "punt");
    assertEquals(event.yardage, 45);
    assertEquals(event.tags, ["muff"]);
    assertEquals(event.participants.length, 2);
  });

  await t.step("builds an extra point event", () => {
    const event = buildPlayEvent({
      gameId: "game-xp",
      driveIndex: 2,
      playIndex: 4,
      quarter: 2,
      clock: "7:30",
      situation: { down: 1, distance: 0, yardLine: 85 },
      offenseTeamId: "team-a",
      defenseTeamId: "team-b",
      call: {
        concept: "extra_point",
        personnel: "special_teams",
        formation: "field_goal",
        motion: "none",
      },
      coverage: {
        front: "field_goal_block",
        coverage: "none",
        pressure: "none",
      },
      outcome: "xp",
      yardage: 0,
      participants: [{ role: "kicker", playerId: "k1", tags: ["xp_made"] }],
    });

    assertEquals(event.outcome, "xp");
    assertEquals(event.participants[0].tags, ["xp_made"]);
  });
});
