import { assertEquals } from "@std/assert";
import { createStubScheduleGenerator } from "./stub-schedule-generator.ts";
import { DEFAULT_TEAMS } from "../team/default-teams.ts";
import type { TeamDivisionInfo } from "./schedule.generator.interface.ts";

const TEAMS: TeamDivisionInfo[] = DEFAULT_TEAMS.map((t, i) => ({
  teamId: `team-${i}`,
  conference: t.conference,
  division: t.division,
}));

const INPUT = {
  seasonId: "season-1",
  seasonLength: 17,
  teams: TEAMS,
};

function generateSchedule(seasonLength = 17) {
  const generator = createStubScheduleGenerator();
  return generator.generate({ ...INPUT, seasonLength });
}

Deno.test("each team plays exactly 17 games", () => {
  const games = generateSchedule();
  const teamGameCounts = new Map<string, number>();

  for (const game of games) {
    teamGameCounts.set(
      game.homeTeamId,
      (teamGameCounts.get(game.homeTeamId) ?? 0) + 1,
    );
    teamGameCounts.set(
      game.awayTeamId,
      (teamGameCounts.get(game.awayTeamId) ?? 0) + 1,
    );
  }

  for (const team of TEAMS) {
    assertEquals(
      teamGameCounts.get(team.teamId),
      17,
      `${team.teamId} should play 17 games`,
    );
  }
});

Deno.test("generates 272 total games (32 teams * 17 games / 2)", () => {
  const games = generateSchedule();
  assertEquals(games.length, 272);
});

Deno.test("no team plays more than once per week", () => {
  const games = generateSchedule();
  const teamWeeks = new Map<string, Set<number>>();

  for (const game of games) {
    for (const teamId of [game.homeTeamId, game.awayTeamId]) {
      if (!teamWeeks.has(teamId)) {
        teamWeeks.set(teamId, new Set());
      }
      const weeks = teamWeeks.get(teamId)!;
      assertEquals(
        weeks.has(game.week),
        false,
        `${teamId} has duplicate game in week ${game.week}`,
      );
      weeks.add(game.week);
    }
  }
});

Deno.test("each team has exactly 1 bye week", () => {
  const games = generateSchedule();
  const teamWeeks = new Map<string, Set<number>>();

  for (const game of games) {
    for (const teamId of [game.homeTeamId, game.awayTeamId]) {
      if (!teamWeeks.has(teamId)) {
        teamWeeks.set(teamId, new Set());
      }
      teamWeeks.get(teamId)!.add(game.week);
    }
  }

  for (const team of TEAMS) {
    const weeksPlayed = teamWeeks.get(team.teamId)!.size;
    assertEquals(
      weeksPlayed,
      17,
      `${team.teamId} plays ${weeksPlayed} weeks, should be 17 (1 bye)`,
    );
  }
});

Deno.test("home team and away team are always different", () => {
  const games = generateSchedule();
  for (const game of games) {
    assertEquals(
      game.homeTeamId !== game.awayTeamId,
      true,
      `Game has same home and away team: ${game.homeTeamId}`,
    );
  }
});

Deno.test("division rivals play each other home-and-away (6 division games per team)", () => {
  const games = generateSchedule();

  // Build division map
  const teamDivision = new Map<string, string>();
  for (const team of TEAMS) {
    teamDivision.set(team.teamId, team.division);
  }

  // Count division games per team
  const divGameCounts = new Map<string, number>();
  for (const game of games) {
    if (
      teamDivision.get(game.homeTeamId) ===
        teamDivision.get(game.awayTeamId)
    ) {
      divGameCounts.set(
        game.homeTeamId,
        (divGameCounts.get(game.homeTeamId) ?? 0) + 1,
      );
      divGameCounts.set(
        game.awayTeamId,
        (divGameCounts.get(game.awayTeamId) ?? 0) + 1,
      );
    }
  }

  for (const team of TEAMS) {
    assertEquals(
      divGameCounts.get(team.teamId),
      6,
      `${team.teamId} should have 6 division games`,
    );
  }
});

Deno.test("all games are within weeks 1-18", () => {
  const games = generateSchedule();
  for (const game of games) {
    assertEquals(game.week >= 1 && game.week <= 18, true);
  }
});

Deno.test(
  "custom seasonLength caps each team's games at seasonLength",
  () => {
    const games = generateSchedule(14);
    const teamGameCounts = new Map<string, number>();
    for (const game of games) {
      teamGameCounts.set(
        game.homeTeamId,
        (teamGameCounts.get(game.homeTeamId) ?? 0) + 1,
      );
      teamGameCounts.set(
        game.awayTeamId,
        (teamGameCounts.get(game.awayTeamId) ?? 0) + 1,
      );
    }
    for (const team of TEAMS) {
      const count = teamGameCounts.get(team.teamId) ?? 0;
      assertEquals(
        count <= 14,
        true,
        `${team.teamId} played ${count} games, expected <= 14`,
      );
    }
  },
);

Deno.test(
  "custom seasonLength confines games to seasonLength + 1 weeks",
  () => {
    const games = generateSchedule(14);
    for (const game of games) {
      assertEquals(game.week >= 1 && game.week <= 15, true);
    }
  },
);

Deno.test("all games reference the correct seasonId", () => {
  const games = generateSchedule();
  for (const game of games) {
    assertEquals(game.seasonId, "season-1");
  }
});
