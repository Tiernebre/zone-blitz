import type {
  GeneratedGame,
  ScheduleGenerator,
  ScheduleGeneratorInput,
  TeamDivisionInfo,
} from "./schedule.generator.interface.ts";

/**
 * Schedule generator for the initial 8-team league.
 *
 * Structure: 2 conferences × 1 division × 4 teams.
 * Each team plays `seasonLength` games across `seasonLength + 1` weeks
 * (exactly 1 bye). Division rivals play home-and-away (6 games),
 * remaining 4 are cross-conference round-robin.
 */
export function createScheduleGenerator(): ScheduleGenerator {
  return {
    generate(input: ScheduleGeneratorInput): GeneratedGame[] {
      const { seasonId, seasonLength, teams } = input;
      const totalWeeks = seasonLength + 1;

      const conferenceMap = new Map<string, TeamDivisionInfo[]>();
      for (const team of teams) {
        if (!conferenceMap.has(team.conference)) {
          conferenceMap.set(team.conference, []);
        }
        conferenceMap.get(team.conference)!.push(team);
      }

      const matchups: { home: string; away: string }[] = [];

      // 1. Division games: home-and-away vs each division rival
      for (const confTeams of conferenceMap.values()) {
        for (let i = 0; i < confTeams.length; i++) {
          for (let j = i + 1; j < confTeams.length; j++) {
            matchups.push({
              home: confTeams[i].teamId,
              away: confTeams[j].teamId,
            });
            matchups.push({
              home: confTeams[j].teamId,
              away: confTeams[i].teamId,
            });
          }
        }
      }

      // 2. Cross-conference games: each team plays every team in the other
      //    conference once. With 4 per conference that gives 4 cross-conf
      //    games per team (alternating home/away by index for balance).
      const conferences = [...conferenceMap.keys()];
      if (conferences.length === 2) {
        const teamsA = conferenceMap.get(conferences[0])!;
        const teamsB = conferenceMap.get(conferences[1])!;
        for (let i = 0; i < teamsA.length; i++) {
          for (let j = 0; j < teamsB.length; j++) {
            if ((i + j) % 2 === 0) {
              matchups.push({ home: teamsA[i].teamId, away: teamsB[j].teamId });
            } else {
              matchups.push({ home: teamsB[j].teamId, away: teamsA[i].teamId });
            }
          }
        }
      }

      // Cap at seasonLength games per team
      const teamGameCounts = new Map<string, number>();
      for (const team of teams) {
        teamGameCounts.set(team.teamId, 0);
      }
      const capped: typeof matchups = [];
      for (const m of matchups) {
        const hc = teamGameCounts.get(m.home) ?? 0;
        const ac = teamGameCounts.get(m.away) ?? 0;
        if (hc < seasonLength && ac < seasonLength) {
          capped.push(m);
          teamGameCounts.set(m.home, hc + 1);
          teamGameCounts.set(m.away, ac + 1);
        }
      }

      // 3. Assign matchups to weeks (greedy)
      const teamWeekUsed = new Map<string, Set<number>>();
      for (const team of teams) {
        teamWeekUsed.set(team.teamId, new Set());
      }

      const games: GeneratedGame[] = [];
      for (const matchup of capped) {
        for (let week = 1; week <= totalWeeks; week++) {
          const homeUsed = teamWeekUsed.get(matchup.home)!;
          const awayUsed = teamWeekUsed.get(matchup.away)!;
          if (!homeUsed.has(week) && !awayUsed.has(week)) {
            games.push({
              seasonId,
              week,
              homeTeamId: matchup.home,
              awayTeamId: matchup.away,
            });
            homeUsed.add(week);
            awayUsed.add(week);
            break;
          }
        }
      }

      return games;
    },
  };
}
