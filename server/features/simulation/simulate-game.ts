import type { GameResult, PlayEvent } from "./events.ts";
import type { GameState, TeamRuntime } from "./resolve-play.ts";
import { resolvePlay } from "./resolve-play.ts";
import { createSeededRng } from "./rng.ts";
import type { SeededRng } from "./rng.ts";

const QUARTER_SECONDS = 900;
const SECONDS_PER_PLAY = 27;
const MAX_PLAYS_PER_GAME = 200;
const FIELD_GOAL_MAX_YARD_LINE = 60;
const TOUCHBACK_YARD_LINE = 25;

interface DriveState {
  offenseIsHome: boolean;
  yardLine: number;
  down: 1 | 2 | 3 | 4;
  distance: number;
}

function getTeamRuntimes(
  home: TeamRuntime,
  away: TeamRuntime,
  offenseIsHome: boolean,
): { offense: TeamRuntime; defense: TeamRuntime } {
  return offenseIsHome
    ? { offense: home, defense: away }
    : { offense: away, defense: home };
}

function formatClock(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function flipPossession(drive: DriveState): DriveState {
  return {
    offenseIsHome: !drive.offenseIsHome,
    yardLine: TOUCHBACK_YARD_LINE,
    down: 1,
    distance: 10,
  };
}

function scoreAfterTouchdown(
  score: { home: number; away: number },
  offenseIsHome: boolean,
  rng: SeededRng,
): void {
  const extraPointMade = rng.next() < 0.94;
  const points = 6 + (extraPointMade ? 1 : 0);
  if (offenseIsHome) {
    score.home += points;
  } else {
    score.away += points;
  }
}

function scoreFieldGoal(
  score: { home: number; away: number },
  offenseIsHome: boolean,
): void {
  if (offenseIsHome) {
    score.home += 3;
  } else {
    score.away += 3;
  }
}

export function simulateGame(
  home: TeamRuntime,
  away: TeamRuntime,
  seed: number,
  gameId: string,
): GameResult {
  const rng = createSeededRng(seed);
  const events: PlayEvent[] = [];
  const score = { home: 0, away: 0 };

  let drive: DriveState = {
    offenseIsHome: rng.next() < 0.5,
    yardLine: TOUCHBACK_YARD_LINE,
    down: 1,
    distance: 10,
  };
  let driveIndex = 0;
  let playIndex = 0;
  let totalPlays = 0;

  for (let q = 1; q <= 4; q++) {
    const quarter = q as 1 | 2 | 3 | 4;
    let clockSeconds = QUARTER_SECONDS;

    if (quarter === 3) {
      drive = flipPossession(drive);
      driveIndex++;
    }

    while (clockSeconds > 0 && totalPlays < MAX_PLAYS_PER_GAME) {
      const { offense, defense } = getTeamRuntimes(
        home,
        away,
        drive.offenseIsHome,
      );

      const homeTeamId = drive.offenseIsHome ? "home" : "away";
      const awayTeamId = drive.offenseIsHome ? "away" : "home";

      const state: GameState = {
        gameId,
        driveIndex,
        playIndex,
        quarter,
        clock: formatClock(clockSeconds),
        situation: {
          down: drive.down,
          distance: drive.distance,
          yardLine: drive.yardLine,
        },
        offenseTeamId: homeTeamId,
        defenseTeamId: awayTeamId,
      };

      const event = resolvePlay(state, offense, defense, rng);
      events.push(event);
      playIndex++;
      totalPlays++;

      const isTurnover = event.tags.includes("turnover");
      const isTouchdown = event.outcome === "touchdown";

      if (isTouchdown) {
        scoreAfterTouchdown(score, drive.offenseIsHome, rng);
        drive = flipPossession(drive);
        driveIndex++;
        clockSeconds -= SECONDS_PER_PLAY;
        continue;
      }

      if (isTurnover) {
        const newYardLine = Math.max(
          20,
          Math.min(80, 100 - drive.yardLine),
        );
        drive = {
          offenseIsHome: !drive.offenseIsHome,
          yardLine: newYardLine,
          down: 1,
          distance: 10,
        };
        driveIndex++;
        clockSeconds -= SECONDS_PER_PLAY;
        continue;
      }

      drive.yardLine = Math.max(
        1,
        Math.min(99, drive.yardLine + event.yardage),
      );

      if (drive.yardLine <= 0) {
        if (drive.offenseIsHome) {
          score.away += 2;
        } else {
          score.home += 2;
        }
        drive = flipPossession(drive);
        driveIndex++;
        clockSeconds -= SECONDS_PER_PLAY;
        continue;
      }

      if (event.yardage >= state.situation.distance) {
        drive.down = 1;
        drive.distance = Math.min(10, 100 - drive.yardLine);
      } else {
        const newDown = drive.down + 1;
        if (newDown > 4) {
          if (
            drive.yardLine >= FIELD_GOAL_MAX_YARD_LINE &&
            drive.yardLine <= 80
          ) {
            const fgDistance = 100 - drive.yardLine + 17;
            const fgProb = Math.max(0.2, 1 - (fgDistance - 20) / 50);
            if (rng.next() < fgProb) {
              scoreFieldGoal(score, drive.offenseIsHome);
            }
            drive = flipPossession(drive);
            driveIndex++;
          } else {
            const puntYards = rng.int(30, 50);
            const newYardLine = Math.max(
              5,
              Math.min(95, 100 - (drive.yardLine + puntYards)),
            );
            drive = {
              offenseIsHome: !drive.offenseIsHome,
              yardLine: newYardLine,
              down: 1,
              distance: 10,
            };
            driveIndex++;
          }
        } else {
          drive.down = newDown as 1 | 2 | 3 | 4;
          drive.distance = drive.distance - event.yardage;
        }
      }

      clockSeconds -= SECONDS_PER_PLAY;
    }
  }

  return {
    gameId,
    seed,
    finalScore: score,
    events,
    boxScore: {},
    driveLog: [],
    injuryReport: [],
  };
}
