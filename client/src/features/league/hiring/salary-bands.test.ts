import { describe, expect, it } from "vitest";
import {
  bandFor,
  COACH_SALARY_BANDS,
  formatMoney,
  medianSalary,
  SCOUT_SALARY_BANDS,
} from "./salary-bands.ts";

describe("bandFor", () => {
  it("returns a coach band for a known coach role", () => {
    expect(bandFor("coach", "HC")).toEqual(COACH_SALARY_BANDS.HC);
  });
  it("returns a scout band for a known scout role", () => {
    expect(bandFor("scout", "DIRECTOR")).toEqual(SCOUT_SALARY_BANDS.DIRECTOR);
  });
  it("returns a default coach band for an unknown coach role", () => {
    expect(bandFor("coach", "UNKNOWN")).toEqual({
      min: 100_000,
      max: 1_000_000,
    });
  });
  it("returns a default scout band for an unknown scout role", () => {
    expect(bandFor("scout", "UNKNOWN")).toEqual({ min: 50_000, max: 300_000 });
  });
});

describe("medianSalary", () => {
  it("computes median of a coach role band", () => {
    expect(medianSalary("coach", "HC")).toBe(12_500_000);
  });
  it("computes median of a scout role band", () => {
    expect(medianSalary("scout", "DIRECTOR")).toBe(525_000);
  });
});

describe("formatMoney", () => {
  it("formats millions with one decimal for small values", () => {
    expect(formatMoney(1_500_000)).toBe("$1.5M");
  });
  it("drops decimals above $10M", () => {
    expect(formatMoney(12_500_000)).toBe("$13M");
  });
  it("formats thousands as K", () => {
    expect(formatMoney(250_000)).toBe("$250K");
  });
  it("falls back to plain dollars for small values", () => {
    expect(formatMoney(500)).toBe("$500");
  });
});
