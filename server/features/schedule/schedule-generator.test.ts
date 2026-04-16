import { assertEquals } from "@std/assert";
import { createScheduleGenerator } from "./schedule-generator.ts";
import type {
  GeneratedGame,
  TeamDivisionInfo,
} from "./schedule.generator.interface.ts";

// --- 8-team initial league (Mountain / Pacific, 1 division each) ---
const INITIAL_TEAMS: TeamDivisionInfo[] = [
  { teamId: "rno", conference: "Mountain", division: "Mountain" },
  { teamId: "slc", conference: "Mountain", division: "Mountain" },
  { teamId: "boi", conference: "Mountain", division: "Mountain" },
  { teamId: "abq", conference: "Mountain", division: "Mountain" },
  { teamId: "pdx", conference: "Pacific", division: "Pacific" },
  { teamId: "sac", conference: "Pacific", division: "Pacific" },
  { teamId: "sdg", conference: "Pacific", division: "Pacific" },
  { teamId: "hnl", conference: "Pacific", division: "Pacific" },
];

const INITIAL_INPUT = {
  seasonId: "season-1",
  seasonLength: 10,
  teams: INITIAL_TEAMS,
};

function generate(
  overrides: Partial<typeof INITIAL_INPUT> = {},
): GeneratedGame[] {
  const generator = createScheduleGenerator();
  return generator.generate({ ...INITIAL_INPUT, ...overrides });
}

// --- helpers ---
function countGamesPerTeam(games: GeneratedGame[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const g of games) {
    counts.set(g.homeTeamId, (counts.get(g.homeTeamId) ?? 0) + 1);
    counts.set(g.awayTeamId, (counts.get(g.awayTeamId) ?? 0) + 1);
  }
  return counts;
}

function weeksPerTeam(games: GeneratedGame[]): Map<string, Set<number>> {
  const map = new Map<string, Set<number>>();
  for (const g of games) {
    for (const id of [g.homeTeamId, g.awayTeamId]) {
      if (!map.has(id)) map.set(id, new Set());
      map.get(id)!.add(g.week);
    }
  }
  return map;
}

// --- core invariants (8-team initial) ---

Deno.test("each team plays exactly seasonLength games", () => {
  const games = generate();
  const counts = countGamesPerTeam(games);
  for (const team of INITIAL_TEAMS) {
    assertEquals(
      counts.get(team.teamId),
      10,
      `${team.teamId} should play 10 games`,
    );
  }
});

Deno.test("total games equals teams * seasonLength / 2", () => {
  const games = generate();
  assertEquals(games.length, (8 * 10) / 2);
});

Deno.test("no team plays more than once per week", () => {
  const games = generate();
  const tw = weeksPerTeam(games);
  // weeksPerTeam uses a Set, so if any week appeared twice it wouldn't
  // be added — but we also need to verify count matches total games.
  const counts = countGamesPerTeam(games);
  for (const team of INITIAL_TEAMS) {
    assertEquals(
      tw.get(team.teamId)!.size,
      counts.get(team.teamId)!,
      `${team.teamId} has a duplicate week`,
    );
  }
});

Deno.test("each team has exactly 1 bye week", () => {
  const games = generate();
  const tw = weeksPerTeam(games);
  const totalWeeks = 10 + 1; // seasonLength + 1
  for (const team of INITIAL_TEAMS) {
    const played = tw.get(team.teamId)!.size;
    assertEquals(
      played,
      totalWeeks - 1,
      `${team.teamId} plays ${played} weeks, expected ${totalWeeks - 1}`,
    );
  }
});

Deno.test("home and away are always different teams", () => {
  const games = generate();
  for (const g of games) {
    assertEquals(
      g.homeTeamId !== g.awayTeamId,
      true,
      `self-play: ${g.homeTeamId}`,
    );
  }
});

Deno.test("all games fall within weeks 1 to seasonLength + 1", () => {
  const games = generate();
  for (const g of games) {
    assertEquals(g.week >= 1 && g.week <= 11, true);
  }
});

Deno.test("all games reference the correct seasonId", () => {
  const games = generate();
  for (const g of games) {
    assertEquals(g.seasonId, "season-1");
  }
});

Deno.test("no duplicate matchup in the same direction", () => {
  const games = generate();
  const seen = new Set<string>();
  for (const g of games) {
    const key = `${g.homeTeamId}:${g.awayTeamId}`;
    assertEquals(seen.has(key), false, `duplicate matchup: ${key}`);
    seen.add(key);
  }
});

// --- conference balance ---

Deno.test("each team plays at least one cross-conference game", () => {
  const games = generate();
  const teamConf = new Map(INITIAL_TEAMS.map((t) => [t.teamId, t.conference]));
  const crossConf = new Set<string>();
  for (const g of games) {
    if (teamConf.get(g.homeTeamId) !== teamConf.get(g.awayTeamId)) {
      crossConf.add(g.homeTeamId);
      crossConf.add(g.awayTeamId);
    }
  }
  for (const team of INITIAL_TEAMS) {
    assertEquals(
      crossConf.has(team.teamId),
      true,
      `${team.teamId} has no cross-conference game`,
    );
  }
});
