import { assertEquals } from "@std/assert";
import {
  createCollectingObserver,
  observePassScore,
  observeRunScore,
  setScoreObserver,
} from "./score-observer.ts";

Deno.test("score observer records run and pass scores while installed", () => {
  const { samples, observer } = createCollectingObserver();
  setScoreObserver(observer);
  try {
    observeRunScore(1.5);
    observeRunScore(-2.25);
    observePassScore(3.0, -4.0);
    observePassScore(-1.0, 5.0);
  } finally {
    setScoreObserver(null);
  }

  assertEquals(samples.blockScore, [1.5, -2.25]);
  assertEquals(samples.protectionScore, [3.0, -1.0]);
  assertEquals(samples.coverageScore, [-4.0, 5.0]);
});

Deno.test("score observer is a no-op when not installed", () => {
  setScoreObserver(null);
  observeRunScore(42);
  observePassScore(1, 2);
  const { samples, observer } = createCollectingObserver();
  setScoreObserver(observer);
  try {
    observeRunScore(99);
  } finally {
    setScoreObserver(null);
  }
  assertEquals(samples.blockScore, [99]);
});

Deno.test("setScoreObserver(null) detaches active observer", () => {
  const { samples, observer } = createCollectingObserver();
  setScoreObserver(observer);
  observeRunScore(1);
  setScoreObserver(null);
  observeRunScore(2);
  assertEquals(samples.blockScore, [1]);
});
