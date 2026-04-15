import { assertEquals } from "@std/assert";
import { formatReport } from "./format-report.ts";
import type { CalibrationReport } from "./harness.ts";
import type { GateResult } from "./three-gate.ts";

function makeGateResult(
  metric: string,
  passed: boolean,
): GateResult {
  return {
    metric,
    passed,
    meanGate: {
      passed,
      simValue: passed ? 50 : 100,
      bandMean: 50,
      threshold: 5,
    },
    spreadGate: {
      passed: true,
      simValue: 10,
      lowerBound: 7.5,
      upperBound: 12.5,
    },
    tailGate: {
      passed: true,
      simP10: 35,
      simP90: 65,
      p10Floor: 30,
      p90Ceiling: 70,
    },
  };
}

Deno.test("formatReport includes pass summary when all pass", () => {
  const report: CalibrationReport = {
    totalGames: 1344,
    totalTeamGames: 2688,
    results: [
      makeGateResult("plays", true),
      makeGateResult("pass_yards", true),
    ],
    failures: [],
    passed: true,
  };

  const output = formatReport(report);
  assertEquals(output.includes("PASSED"), true);
  assertEquals(output.includes("2/2 metrics passed"), true);
});

Deno.test("formatReport includes failure details when metrics fail", () => {
  const failedGate = makeGateResult("pass_yards", false);
  failedGate.meanGate.passed = false;

  const report: CalibrationReport = {
    totalGames: 1344,
    totalTeamGames: 2688,
    results: [makeGateResult("plays", true), failedGate],
    failures: [failedGate],
    passed: false,
  };

  const output = formatReport(report);
  assertEquals(output.includes("FAILED"), true);
  assertEquals(output.includes("1/2 metrics passed"), true);
  assertEquals(output.includes("pass_yards"), true);
  assertEquals(output.includes("mean"), true);
});

Deno.test("formatReport shows failing gate names for each failed metric", () => {
  const failedGate = makeGateResult("yards_per_attempt", false);
  failedGate.meanGate.passed = false;
  failedGate.spreadGate.passed = false;
  failedGate.tailGate.passed = false;

  const report: CalibrationReport = {
    totalGames: 1344,
    totalTeamGames: 2688,
    results: [failedGate],
    failures: [failedGate],
    passed: false,
  };

  const output = formatReport(report);
  assertEquals(output.includes("mean"), true);
  assertEquals(output.includes("spread"), true);
  assertEquals(output.includes("tail"), true);
});

Deno.test("formatReport includes game count details", () => {
  const report: CalibrationReport = {
    totalGames: 1344,
    totalTeamGames: 2688,
    results: [makeGateResult("plays", true)],
    failures: [],
    passed: true,
  };

  const output = formatReport(report);
  assertEquals(output.includes("1344"), true);
  assertEquals(output.includes("2688"), true);
});
