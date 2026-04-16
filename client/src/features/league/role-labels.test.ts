import { describe, expect, it } from "vitest";
import { roleLabel } from "./role-labels.ts";

describe("roleLabel", () => {
  it("returns the coach label for known coach roles", () => {
    expect(roleLabel("coach", "HC")).toBe("Head Coach");
  });

  it("falls back to the raw role when the coach role is unknown", () => {
    expect(roleLabel("coach", "UNKNOWN")).toBe("UNKNOWN");
  });

  it("returns the scout label for known scout roles", () => {
    expect(roleLabel("scout", "AREA_SCOUT")).toBe("Area Scout");
  });

  it("falls back to the raw role when the scout role is unknown", () => {
    expect(roleLabel("scout", "UNKNOWN")).toBe("UNKNOWN");
  });
});
