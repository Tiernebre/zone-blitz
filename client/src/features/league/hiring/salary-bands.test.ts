import { describe, expect, it } from "vitest";
import type { HiringCandidateSummary } from "@zone-blitz/shared";
import {
  bandFor,
  COACH_SALARY_BANDS,
  expectedSalaryForCandidate,
  formatMoney,
  medianSalary,
  roleTenureYears,
  SCOUT_SALARY_BANDS,
} from "./salary-bands.ts";

function coachCandidate(
  overrides: Partial<HiringCandidateSummary> = {},
): HiringCandidateSummary {
  return {
    id: "c1",
    leagueId: "lg",
    staffType: "coach",
    firstName: "First",
    lastName: "Last",
    role: "HC",
    specialty: "offense",
    offensiveArchetype: null,
    defensiveArchetype: null,
    age: 50,
    yearsExperience: 20,
    headCoachYears: 5,
    coordinatorYears: 7,
    positionCoachYears: 8,
    positionBackground: "QB",
    positionFocus: null,
    regionFocus: null,
    ...overrides,
  };
}

function scoutCandidate(
  overrides: Partial<HiringCandidateSummary> = {},
): HiringCandidateSummary {
  return {
    id: "s1",
    leagueId: "lg",
    staffType: "scout",
    firstName: "First",
    lastName: "Last",
    role: "DIRECTOR",
    specialty: null,
    offensiveArchetype: null,
    defensiveArchetype: null,
    age: 50,
    yearsExperience: 20,
    headCoachYears: 0,
    coordinatorYears: 0,
    positionCoachYears: 0,
    positionBackground: null,
    positionFocus: "QB",
    regionFocus: "NATIONAL",
    ...overrides,
  };
}

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

describe("roleTenureYears", () => {
  it("returns headCoachYears for HC candidates", () => {
    expect(
      roleTenureYears(coachCandidate({ role: "HC", headCoachYears: 4 })),
    ).toBe(4);
  });
  it("returns coordinatorYears for OC/DC/STC", () => {
    expect(
      roleTenureYears(coachCandidate({ role: "OC", coordinatorYears: 6 })),
    ).toBe(6);
    expect(
      roleTenureYears(coachCandidate({ role: "DC", coordinatorYears: 3 })),
    ).toBe(3);
    expect(
      roleTenureYears(coachCandidate({ role: "STC", coordinatorYears: 1 })),
    ).toBe(1);
  });
  it("returns positionCoachYears for position coaches", () => {
    expect(
      roleTenureYears(coachCandidate({ role: "QB", positionCoachYears: 10 })),
    ).toBe(10);
  });
  it("returns yearsExperience for scouts", () => {
    expect(
      roleTenureYears(scoutCandidate({ yearsExperience: 12 })),
    ).toBe(12);
  });
  it("falls back to 0 when role-tenure fields are absent", () => {
    const sparseCoach = {
      staffType: "coach",
      role: "QB",
    } as unknown as HiringCandidateSummary;
    expect(roleTenureYears(sparseCoach)).toBe(0);
    const sparseScout = {
      staffType: "scout",
      role: "DIRECTOR",
    } as unknown as HiringCandidateSummary;
    expect(roleTenureYears(sparseScout)).toBe(0);
  });
});

describe("expectedSalaryForCandidate", () => {
  it("produces different salaries for unproven vs proven HCs in the same pool", () => {
    const unproven = expectedSalaryForCandidate(
      coachCandidate({
        role: "HC",
        age: 40,
        yearsExperience: 12,
        headCoachYears: 0,
        coordinatorYears: 4,
        positionCoachYears: 8,
      }),
    );
    const proven = expectedSalaryForCandidate(
      coachCandidate({
        role: "HC",
        age: 55,
        yearsExperience: 28,
        headCoachYears: 12,
        coordinatorYears: 8,
        positionCoachYears: 8,
      }),
    );
    expect(proven).toBeGreaterThan(unproven);
    expect(proven - unproven).toBeGreaterThan(3_000_000);
  });

  it("keeps expected salary within the role's market band", () => {
    const band = bandFor("coach", "HC");
    const proven = expectedSalaryForCandidate(
      coachCandidate({
        role: "HC",
        age: 65,
        yearsExperience: 40,
        headCoachYears: 20,
        coordinatorYears: 10,
        positionCoachYears: 10,
      }),
    );
    const raw = expectedSalaryForCandidate(
      coachCandidate({
        role: "HC",
        age: 36,
        yearsExperience: 1,
        headCoachYears: 0,
        coordinatorYears: 0,
        positionCoachYears: 1,
      }),
    );
    expect(proven).toBeLessThanOrEqual(band.max);
    expect(raw).toBeGreaterThanOrEqual(band.min);
  });

  it("penalises first-time HCs relative to the band midpoint", () => {
    const firstTime = expectedSalaryForCandidate(
      coachCandidate({
        role: "HC",
        age: 42,
        yearsExperience: 15,
        headCoachYears: 0,
        coordinatorYears: 5,
        positionCoachYears: 10,
      }),
    );
    expect(firstTime).toBeLessThan(medianSalary("coach", "HC"));
  });

  it("rewards a first-time HC with strong coordinator experience more than a raw rookie", () => {
    const rookie = expectedSalaryForCandidate(
      coachCandidate({
        role: "HC",
        age: 38,
        yearsExperience: 4,
        headCoachYears: 0,
        coordinatorYears: 0,
        positionCoachYears: 4,
      }),
    );
    const provenCoordinator = expectedSalaryForCandidate(
      coachCandidate({
        role: "HC",
        age: 45,
        yearsExperience: 20,
        headCoachYears: 0,
        coordinatorYears: 10,
        positionCoachYears: 10,
      }),
    );
    expect(provenCoordinator).toBeGreaterThan(rookie);
  });

  it("produces salaries spanning a wide range across the pool", () => {
    const values = [
      coachCandidate({
        role: "HC",
        age: 38,
        yearsExperience: 8,
        headCoachYears: 0,
        coordinatorYears: 2,
        positionCoachYears: 6,
      }),
      coachCandidate({
        role: "HC",
        age: 48,
        yearsExperience: 22,
        headCoachYears: 5,
        coordinatorYears: 8,
        positionCoachYears: 9,
      }),
      coachCandidate({
        role: "HC",
        age: 60,
        yearsExperience: 35,
        headCoachYears: 15,
        coordinatorYears: 10,
        positionCoachYears: 10,
      }),
    ].map(expectedSalaryForCandidate);
    const spread = Math.max(...values) - Math.min(...values);
    expect(spread).toBeGreaterThan(4_000_000);
  });

  it("scales scout salary by years of experience", () => {
    const junior = expectedSalaryForCandidate(
      scoutCandidate({ role: "DIRECTOR", age: 38, yearsExperience: 4 }),
    );
    const senior = expectedSalaryForCandidate(
      scoutCandidate({ role: "DIRECTOR", age: 58, yearsExperience: 30 }),
    );
    expect(senior).toBeGreaterThan(junior);
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
