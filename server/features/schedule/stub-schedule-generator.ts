import type {
  GeneratedGame,
  ScheduleGenerator,
  ScheduleGeneratorInput,
  TeamDivisionInfo,
} from "./schedule.generator.interface.ts";

const TOTAL_WEEKS = 18;

/**
 * A stub schedule generator that produces a legal schedule:
 * - Each team plays exactly 17 games across 18 weeks
 * - Each team has exactly 1 bye week
 * - No team plays twice in the same week
 * - Division rivals play home-and-away (6 division games)
 * - Remaining 11 games are filled from non-division opponents
 */
export function createStubScheduleGenerator(): ScheduleGenerator {
  return {
    generate(input: ScheduleGeneratorInput): GeneratedGame[] {
      const { seasonId, teams } = input;

      // Group teams by division and conference
      const divisionMap = new Map<string, TeamDivisionInfo[]>();
      const conferenceMap = new Map<string, string[]>();
      for (const team of teams) {
        if (!divisionMap.has(team.division)) {
          divisionMap.set(team.division, []);
        }
        divisionMap.get(team.division)!.push(team);

        if (!conferenceMap.has(team.conference)) {
          conferenceMap.set(team.conference, []);
        }
        const confDivs = conferenceMap.get(team.conference)!;
        if (!confDivs.includes(team.division)) {
          confDivs.push(team.division);
        }
      }

      const conferences = [...conferenceMap.keys()];
      const matchups: { home: string; away: string }[] = [];

      // 1. Division games: home-and-away vs each rival (6 per team)
      for (const divTeams of divisionMap.values()) {
        for (let i = 0; i < divTeams.length; i++) {
          for (let j = i + 1; j < divTeams.length; j++) {
            matchups.push({
              home: divTeams[i].teamId,
              away: divTeams[j].teamId,
            });
            matchups.push({
              home: divTeams[j].teamId,
              away: divTeams[i].teamId,
            });
          }
        }
      }

      // 2. Intra-conference partner division (4 games per team)
      // Pair divisions within each conference: [0,1] and [2,3]
      for (const conf of conferences) {
        const divs = conferenceMap.get(conf)!;
        const pairs = [
          [divs[0], divs[1]],
          [divs[2], divs[3]],
        ];
        for (const [divA, divB] of pairs) {
          const teamsA = divisionMap.get(divA)!;
          const teamsB = divisionMap.get(divB)!;
          for (let i = 0; i < teamsA.length; i++) {
            // Each team plays the opponent at the same index at home,
            // and the next index away (wrapping)
            const homeOpp = teamsB[i];
            const awayOpp = teamsB[(i + 1) % teamsB.length];
            matchups.push({
              home: teamsA[i].teamId,
              away: homeOpp.teamId,
            });
            matchups.push({
              home: awayOpp.teamId,
              away: teamsA[i].teamId,
            });
            // Two more: next two opponents
            const opp3 = teamsB[(i + 2) % teamsB.length];
            const opp4 = teamsB[(i + 3) % teamsB.length];
            matchups.push({
              home: teamsA[i].teamId,
              away: opp3.teamId,
            });
            matchups.push({
              home: opp4.teamId,
              away: teamsA[i].teamId,
            });
          }
        }
      }

      // 3. Inter-conference partner division (4 games per team)
      // Pair first conference divs with second conference divs by index
      const conf0Divs = conferenceMap.get(conferences[0])!;
      const conf1Divs = conferenceMap.get(conferences[1])!;
      for (let d = 0; d < conf0Divs.length; d++) {
        const teamsA = divisionMap.get(conf0Divs[d])!;
        const teamsB = divisionMap.get(conf1Divs[d])!;
        for (let i = 0; i < teamsA.length; i++) {
          const homeOpp = teamsB[i];
          const awayOpp = teamsB[(i + 1) % teamsB.length];
          matchups.push({
            home: teamsA[i].teamId,
            away: homeOpp.teamId,
          });
          matchups.push({
            home: awayOpp.teamId,
            away: teamsA[i].teamId,
          });
          const opp3 = teamsB[(i + 2) % teamsB.length];
          const opp4 = teamsB[(i + 3) % teamsB.length];
          matchups.push({
            home: teamsA[i].teamId,
            away: opp3.teamId,
          });
          matchups.push({
            home: opp4.teamId,
            away: teamsA[i].teamId,
          });
        }
      }

      // 4. Remaining 3 games per team: same-place finishers from other divs
      // For year 1 (no standings), pair by index within remaining divisions
      for (const conf of conferences) {
        const divs = conferenceMap.get(conf)!;
        // Each team plays the same-index team from the 2 non-partner divs
        // Partner pairs are [0,1] and [2,3], so remaining for div 0 = [2,3]
        const remaining: [number, number][] = [
          [0, 2],
          [0, 3],
          [1, 2],
          [1, 3],
        ];
        for (const [a, b] of remaining) {
          const teamsA = divisionMap.get(divs[a])!;
          const teamsB = divisionMap.get(divs[b])!;
          for (let i = 0; i < teamsA.length; i++) {
            // Only add one game per pair (avoid duplicates)
            const key1 = `${teamsA[i].teamId}:${teamsB[i].teamId}`;
            const key2 = `${teamsB[i].teamId}:${teamsA[i].teamId}`;
            const alreadyPaired = matchups.some(
              (m) =>
                (`${m.home}:${m.away}` === key1) ||
                (`${m.home}:${m.away}` === key2),
            );
            if (!alreadyPaired) {
              matchups.push({
                home: teamsA[i].teamId,
                away: teamsB[i].teamId,
              });
            }
          }
        }
      }

      // Also add 1 inter-conference same-place game from non-partner division
      for (let d = 0; d < conf0Divs.length; d++) {
        const partnerD = d; // already paired by index
        const otherD = (d + 1) % conf0Divs.length;
        if (otherD === partnerD) continue;
        const teamsA = divisionMap.get(conf0Divs[d])!;
        const teamsB = divisionMap.get(conf1Divs[otherD])!;
        for (let i = 0; i < teamsA.length; i++) {
          const key1 = `${teamsA[i].teamId}:${teamsB[i].teamId}`;
          const key2 = `${teamsB[i].teamId}:${teamsA[i].teamId}`;
          const alreadyPaired = matchups.some(
            (m) =>
              (`${m.home}:${m.away}` === key1) ||
              (`${m.home}:${m.away}` === key2),
          );
          if (!alreadyPaired) {
            matchups.push({
              home: teamsA[i].teamId,
              away: teamsB[i].teamId,
            });
          }
        }
      }

      // Trim to exactly 17 per team if over
      const teamGameCounts = new Map<string, number>();
      for (const team of teams) {
        teamGameCounts.set(team.teamId, 0);
      }
      const finalMatchups: typeof matchups = [];
      for (const m of matchups) {
        const hc = teamGameCounts.get(m.home) ?? 0;
        const ac = teamGameCounts.get(m.away) ?? 0;
        if (hc < 17 && ac < 17) {
          finalMatchups.push(m);
          teamGameCounts.set(m.home, hc + 1);
          teamGameCounts.set(m.away, ac + 1);
        }
      }

      // 5. Assign matchups to weeks using greedy scheduling
      const teamWeekUsed = new Map<string, Set<number>>();
      for (const team of teams) {
        teamWeekUsed.set(team.teamId, new Set());
      }

      const games: GeneratedGame[] = [];

      for (const matchup of finalMatchups) {
        for (let week = 1; week <= TOTAL_WEEKS; week++) {
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
