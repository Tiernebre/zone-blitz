import type { GameResult, GameSimulator } from "@zone-blitz/shared";

export function createGameSimulator(): GameSimulator {
  return {
    simulate(homeTeamId, awayTeamId) {
      // Placeholder — real simulation engine will replace this
      const homeScore = Math.floor(Math.random() * 42);
      const awayScore = Math.floor(Math.random() * 42);

      const result: GameResult = {
        homeScore,
        awayScore,
        events: [
          {
            quarter: 1,
            timestamp: 0,
            description:
              `Game between ${homeTeamId} and ${awayTeamId} simulated`,
          },
        ],
      };

      return result;
    },
  };
}
