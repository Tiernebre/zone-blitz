import type { CalibrationReport } from "./harness.ts";
import type { GateResult } from "./three-gate.ts";

function formatFailedGates(result: GateResult): string {
  const gates: string[] = [];

  if (!result.meanGate.passed) {
    gates.push(
      `  - mean: sim=${result.meanGate.simValue.toFixed(2)}, band=${
        result.meanGate.bandMean.toFixed(2)
      } ±${result.meanGate.threshold.toFixed(2)}`,
    );
  }

  if (!result.spreadGate.passed) {
    gates.push(
      `  - spread: sim sd=${result.spreadGate.simValue.toFixed(2)}, expected [${
        result.spreadGate.lowerBound.toFixed(2)
      }, ${result.spreadGate.upperBound.toFixed(2)}]`,
    );
  }

  if (!result.tailGate.passed) {
    gates.push(
      `  - tail: sim p10=${result.tailGate.simP10.toFixed(2)} (floor ${
        result.tailGate.p10Floor.toFixed(2)
      }), sim p90=${result.tailGate.simP90.toFixed(2)} (ceiling ${
        result.tailGate.p90Ceiling.toFixed(2)
      })`,
    );
  }

  return gates.join("\n");
}

export function formatReport(report: CalibrationReport): string {
  const passCount = report.results.length - report.failures.length;
  const total = report.results.length;
  const status = report.passed ? "PASSED" : "FAILED";

  const lines: string[] = [
    `Calibration ${status}: ${passCount}/${total} metrics passed`,
    `Games: ${report.totalGames} | Team-games: ${report.totalTeamGames}`,
  ];

  if (report.failures.length > 0) {
    lines.push("");
    lines.push("Failed metrics:");
    for (const failure of report.failures) {
      lines.push(`- ${failure.metric}`);
      lines.push(formatFailedGates(failure));
    }
  }

  return lines.join("\n");
}
