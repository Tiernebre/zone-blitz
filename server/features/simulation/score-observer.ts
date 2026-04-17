/**
 * Module-level observer for the intermediate matchup scores produced during
 * play synthesis. The fit-outcomes pipeline activates this observer to capture
 * the `blockScore`, `protectionScore`, and `coverageScore` distributions
 * without having to thread a new parameter through every simulation entry
 * point. It has no effect when no observer is installed.
 */
export interface ScoreObserver {
  onRun(blockScore: number): void;
  onPass(protectionScore: number, coverageScore: number): void;
}

let current: ScoreObserver | null = null;

export function setScoreObserver(observer: ScoreObserver | null): void {
  current = observer;
}

export function observeRunScore(blockScore: number): void {
  current?.onRun(blockScore);
}

export function observePassScore(
  protectionScore: number,
  coverageScore: number,
): void {
  current?.onPass(protectionScore, coverageScore);
}

export interface ScoreSamples {
  blockScore: number[];
  protectionScore: number[];
  coverageScore: number[];
}

export function createCollectingObserver(): {
  samples: ScoreSamples;
  observer: ScoreObserver;
} {
  const samples: ScoreSamples = {
    blockScore: [],
    protectionScore: [],
    coverageScore: [],
  };
  const observer: ScoreObserver = {
    onRun: (s) => samples.blockScore.push(s),
    onPass: (p, c) => {
      samples.protectionScore.push(p);
      samples.coverageScore.push(c);
    },
  };
  return { samples, observer };
}
