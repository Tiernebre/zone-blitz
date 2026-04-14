import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { SchemeFingerprint } from "@zone-blitz/shared";
import { FingerprintPanel } from "./fingerprint-panel.tsx";

afterEach(() => {
  cleanup();
});

function offensiveFingerprint(): SchemeFingerprint {
  return {
    offense: {
      runPassLean: 40,
      tempo: 55,
      personnelWeight: 50,
      formationUnderCenterShotgun: 30,
      preSnapMotionRate: 80,
      passingStyle: 30,
      passingDepth: 45,
      runGameBlocking: 25,
      rpoIntegration: 30,
    },
    defense: null,
    overrides: {},
  };
}

describe("FingerprintPanel", () => {
  it("renders a skeleton while loading", () => {
    render(<FingerprintPanel isLoading />);
    expect(screen.getByTestId("fingerprint-skeleton")).toBeDefined();
  });

  it("renders a bar for each offensive axis when the OC is hired", () => {
    render(<FingerprintPanel fingerprint={offensiveFingerprint()} />);
    // ADR 0007 names 9 offensive axes.
    expect(screen.getByText(/Run \/ Pass lean/i)).toBeDefined();
    expect(screen.getByText(/RPO integration/i)).toBeDefined();
    expect(screen.getByText(/Passing depth/i)).toBeDefined();
  });

  it("shows an empty-state for missing coordinators, not fabricated bars", () => {
    render(
      <FingerprintPanel
        fingerprint={{ offense: null, defense: null, overrides: {} }}
      />,
    );
    expect(screen.getByText(/No offensive coordinator/i)).toBeDefined();
    expect(screen.getByText(/No defensive coordinator/i)).toBeDefined();
  });

  it("renders numbers as bar positions, never as text", () => {
    render(<FingerprintPanel fingerprint={offensiveFingerprint()} />);
    // ADR 0005: no numeric value should be exposed to the user.
    expect(screen.queryByText("40")).toBeNull();
    expect(screen.queryByText("80")).toBeNull();
  });
});
