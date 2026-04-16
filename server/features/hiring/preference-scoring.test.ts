import { assertAlmostEquals, assertEquals } from "@std/assert";
import type {
  DefensiveTendencies,
  OffensiveTendencies,
} from "@zone-blitz/shared";
import {
  type CoachCandidate,
  compensationScore,
  computePreferenceScore,
  type FranchiseProfile,
  type FranchiseStaffMember,
  marketTierForCity,
  marketTierScore,
  type Offer,
  philosophyFitScore,
  resolveContestForCandidate,
  type ScoutCandidate,
  staffFitScore,
} from "./preference-scoring.ts";

function offense(
  overrides: Partial<OffensiveTendencies> = {},
): OffensiveTendencies {
  return {
    runPassLean: 50,
    tempo: 50,
    personnelWeight: 50,
    formationUnderCenterShotgun: 50,
    preSnapMotionRate: 50,
    passingStyle: 50,
    passingDepth: 50,
    runGameBlocking: 50,
    rpoIntegration: 50,
    ...overrides,
  };
}

function defense(
  overrides: Partial<DefensiveTendencies> = {},
): DefensiveTendencies {
  return {
    frontOddEven: 50,
    gapResponsibility: 50,
    subPackageLean: 50,
    coverageManZone: 50,
    coverageShell: 50,
    cornerPressOff: 50,
    pressureRate: 50,
    disguiseRate: 50,
    ...overrides,
  };
}

function coachCandidate(
  overrides: Partial<CoachCandidate> = {},
): CoachCandidate {
  return {
    id: "c1",
    staffType: "coach",
    role: "OC",
    marketTierPref: 50,
    philosophyFitPref: 50,
    staffFitPref: 50,
    compensationPref: 50,
    minimumThreshold: 50,
    offense: null,
    defense: null,
    ...overrides,
  };
}

function scoutCandidate(
  overrides: Partial<ScoutCandidate> = {},
): ScoutCandidate {
  return {
    id: "s1",
    staffType: "scout",
    role: "DIRECTOR",
    marketTierPref: 50,
    philosophyFitPref: 50,
    staffFitPref: 50,
    compensationPref: 50,
    minimumThreshold: 50,
    ...overrides,
  };
}

function franchise(
  overrides: Partial<FranchiseProfile> = {},
): FranchiseProfile {
  return {
    franchiseId: "f1",
    marketTier: "medium",
    existingStaff: [],
    ...overrides,
  };
}

function staffMember(
  overrides: Partial<FranchiseStaffMember> = {},
): FranchiseStaffMember {
  return {
    staffType: "coach",
    role: "HC",
    offense: null,
    defense: null,
    ...overrides,
  };
}

function offer(overrides: Partial<Offer> = {}): Offer {
  return {
    id: "o1",
    franchiseId: "f1",
    salary: 3_000_000,
    contractYears: 3,
    incentives: [],
    ...overrides,
  };
}

const OC_BAND = { min: 1_500_000, max: 6_000_000 };

Deno.test("marketTierScore maps the 3 tiers", () => {
  assertEquals(marketTierScore("large"), 100);
  assertEquals(marketTierScore("medium"), 60);
  assertEquals(marketTierScore("small"), 25);
});

Deno.test("marketTierForCity classifies known large-market cities", () => {
  assertEquals(marketTierForCity("New York"), "large");
  assertEquals(marketTierForCity("Los Angeles"), "large");
  assertEquals(marketTierForCity("Chicago"), "large");
});

Deno.test("marketTierForCity classifies medium and small markets", () => {
  assertEquals(marketTierForCity("Portland"), "medium");
  assertEquals(marketTierForCity("Reno"), "small");
  assertEquals(marketTierForCity("Boise"), "small");
});

Deno.test("marketTierForCity falls back to small when city is unknown", () => {
  assertEquals(marketTierForCity("Nonexistent Town"), "small");
});

Deno.test(
  "compensationScore is 0 at or below band floor, 100 at band ceiling",
  () => {
    assertEquals(compensationScore(offer({ salary: OC_BAND.min }), OC_BAND), 0);
    assertEquals(compensationScore(offer({ salary: 500_000 }), OC_BAND), 0);
    assertEquals(
      compensationScore(offer({ salary: OC_BAND.max }), OC_BAND),
      100,
    );
  },
);

Deno.test("compensationScore interpolates linearly inside the band", () => {
  const mid = (OC_BAND.min + OC_BAND.max) / 2;
  assertAlmostEquals(
    compensationScore(offer({ salary: mid }), OC_BAND),
    50,
    0.5,
  );
});

Deno.test("compensationScore credits incentive totals on top of base salary", () => {
  const noIncentive = compensationScore(
    offer({ salary: OC_BAND.min, incentives: [] }),
    OC_BAND,
  );
  const withIncentive = compensationScore(
    offer({
      salary: OC_BAND.min,
      incentives: [{ type: "playoff", value: 1_000_000 }],
    }),
    OC_BAND,
  );
  assertEquals(noIncentive, 0);
  // Incentive equal to (max - min)/4.5 of the band pushes above 0.
  assertEquals(withIncentive > noIncentive, true);
});

Deno.test("compensationScore caps at 100 when pay blows through the ceiling", () => {
  const huge = compensationScore(
    offer({
      salary: OC_BAND.max * 2,
      incentives: [{ type: "championship", value: 10_000_000 }],
    }),
    OC_BAND,
  );
  assertEquals(huge, 100);
});

Deno.test(
  "philosophyFitScore returns 50 for scout candidates (no tendencies)",
  () => {
    assertEquals(philosophyFitScore(scoutCandidate(), franchise()), 50);
  },
);

Deno.test(
  "philosophyFitScore returns 50 when neither side has comparable tendencies",
  () => {
    const candidate = coachCandidate({ offense: offense() });
    const team = franchise({ existingStaff: [staffMember({ role: "HC" })] });
    assertEquals(philosophyFitScore(candidate, team), 50);
  },
);

Deno.test(
  "philosophyFitScore is 100 when candidate tendencies match franchise OC",
  () => {
    const vector = offense({ runPassLean: 20, tempo: 80, passingDepth: 90 });
    const candidate = coachCandidate({ offense: vector });
    const team = franchise({
      existingStaff: [
        staffMember({ role: "OC", offense: { ...vector } }),
      ],
    });
    assertEquals(philosophyFitScore(candidate, team), 100);
  },
);

Deno.test(
  "philosophyFitScore drops toward 0 when tendencies are opposite",
  () => {
    const low = offense({
      runPassLean: 0,
      tempo: 0,
      personnelWeight: 0,
      formationUnderCenterShotgun: 0,
      preSnapMotionRate: 0,
      passingStyle: 0,
      passingDepth: 0,
      runGameBlocking: 0,
      rpoIntegration: 0,
    });
    const high = offense({
      runPassLean: 100,
      tempo: 100,
      personnelWeight: 100,
      formationUnderCenterShotgun: 100,
      preSnapMotionRate: 100,
      passingStyle: 100,
      passingDepth: 100,
      runGameBlocking: 100,
      rpoIntegration: 100,
    });
    const candidate = coachCandidate({ offense: low });
    const team = franchise({
      existingStaff: [staffMember({ role: "OC", offense: high })],
    });
    assertEquals(philosophyFitScore(candidate, team), 0);
  },
);

Deno.test(
  "philosophyFitScore compares defensive candidate against franchise DC",
  () => {
    const vector = defense({
      coverageManZone: 20,
      pressureRate: 85,
      disguiseRate: 70,
    });
    const candidate = coachCandidate({ role: "DC", defense: vector });
    const team = franchise({
      existingStaff: [staffMember({ role: "DC", defense: { ...vector } })],
    });
    assertEquals(philosophyFitScore(candidate, team), 100);
  },
);

Deno.test(
  "staffFitScore returns 50 for scouts (no tendencies to compare)",
  () => {
    assertEquals(staffFitScore(scoutCandidate(), franchise()), 50);
  },
);

Deno.test(
  "staffFitScore returns 50 when the franchise has no comparable staff",
  () => {
    assertEquals(
      staffFitScore(
        coachCandidate({ offense: offense() }),
        franchise({ existingStaff: [staffMember({ role: "HC" })] }),
      ),
      50,
    );
  },
);

Deno.test(
  "staffFitScore is high when candidate aligns with existing staff",
  () => {
    const vector = offense({ runPassLean: 30, tempo: 65 });
    const candidate = coachCandidate({ offense: vector });
    const team = franchise({
      existingStaff: [
        staffMember({ role: "OC", offense: { ...vector } }),
      ],
    });
    assertEquals(staffFitScore(candidate, team) >= 95, true);
  },
);

Deno.test(
  "staffFitScore skips scout members on the existing staff",
  () => {
    // A scout on the existing staff has no tendencies — it must be
    // ignored, not counted as a miss. With only scouts present the
    // score falls back to neutral.
    const candidate = coachCandidate({ offense: offense() });
    const team = franchise({
      existingStaff: [
        { staffType: "scout", role: "DIRECTOR", offense: null, defense: null },
      ],
    });
    assertEquals(staffFitScore(candidate, team), 50);
  },
);

Deno.test(
  "staffFitScore compares defensive candidates against defensive staff",
  () => {
    const vector = defense({ coverageManZone: 30, pressureRate: 80 });
    const candidate = coachCandidate({ role: "DC", defense: vector });
    const team = franchise({
      existingStaff: [staffMember({ role: "DC", defense: { ...vector } })],
    });
    assertEquals(staffFitScore(candidate, team) >= 95, true);
  },
);

Deno.test(
  "compensationScore degrades gracefully for a zero-width salary band",
  () => {
    // A role band where min === max is degenerate data; the function
    // must still return a sensible 0/100 without dividing by zero.
    const flat = { min: 500_000, max: 500_000 };
    assertEquals(compensationScore(offer({ salary: 499_000 }), flat), 0);
    assertEquals(compensationScore(offer({ salary: 500_000 }), flat), 100);
  },
);

Deno.test(
  "staffFitScore averages across multiple comparable staff members",
  () => {
    const vector = offense({ runPassLean: 40 });
    const candidate = coachCandidate({ offense: vector });
    const team = franchise({
      existingStaff: [
        staffMember({ role: "OC", offense: { ...vector } }),
        staffMember({
          role: "HC",
          offense: offense({ runPassLean: 100, tempo: 100 }),
        }),
      ],
    });
    const score = staffFitScore(candidate, team);
    assertEquals(score > 50 && score < 100, true);
  },
);

Deno.test("computePreferenceScore returns a number in [0, 100]", () => {
  const score = computePreferenceScore(
    coachCandidate(),
    franchise(),
    offer(),
    OC_BAND,
  );
  assertEquals(score >= 0 && score <= 100, true);
});

Deno.test(
  "computePreferenceScore falls back to 50 when all preferences are zero",
  () => {
    const candidate = coachCandidate({
      marketTierPref: 0,
      philosophyFitPref: 0,
      staffFitPref: 0,
      compensationPref: 0,
    });
    assertEquals(
      computePreferenceScore(candidate, franchise(), offer(), OC_BAND),
      50,
    );
  },
);

Deno.test(
  "computePreferenceScore isolates the single preference when others are zero",
  () => {
    // Only compensation preference active — score must equal compensationScore.
    const candidate = coachCandidate({
      marketTierPref: 0,
      philosophyFitPref: 0,
      staffFitPref: 0,
      compensationPref: 80,
    });
    const theOffer = offer({ salary: OC_BAND.max });
    assertEquals(
      computePreferenceScore(candidate, franchise(), theOffer, OC_BAND),
      compensationScore(theOffer, OC_BAND),
    );
  },
);

Deno.test(
  "computePreferenceScore rewards a philosophy-matched large-market rich offer",
  () => {
    const vector = offense({ runPassLean: 20, tempo: 80 });
    const candidate = coachCandidate({
      offense: vector,
      marketTierPref: 75,
      philosophyFitPref: 90,
      staffFitPref: 40,
      compensationPref: 60,
    });
    const team = franchise({
      marketTier: "large",
      existingStaff: [
        staffMember({ role: "OC", offense: { ...vector } }),
      ],
    });
    const score = computePreferenceScore(
      candidate,
      team,
      offer({ salary: OC_BAND.max }),
      OC_BAND,
    );
    assertEquals(score >= 75, true, `expected >=75 got ${score}`);
  },
);

Deno.test(
  "resolveContestForCandidate returns the single offer when it clears the threshold",
  () => {
    const candidate = coachCandidate({ minimumThreshold: 40 });
    const result = resolveContestForCandidate(candidate, [
      {
        franchise: franchise({ marketTier: "large" }),
        offer: offer({ id: "A", salary: OC_BAND.max }),
        roleBand: OC_BAND,
      },
    ]);
    assertEquals(result.chosenOfferId, "A");
  },
);

Deno.test(
  "resolveContestForCandidate returns null when the only offer is below threshold",
  () => {
    const candidate = coachCandidate({
      minimumThreshold: 95,
      marketTierPref: 100,
      philosophyFitPref: 0,
      staffFitPref: 0,
      compensationPref: 0,
    });
    // Small market + no other factors → market score 25, well below 95.
    const result = resolveContestForCandidate(candidate, [
      {
        franchise: franchise({ marketTier: "small" }),
        offer: offer({ id: "A" }),
        roleBand: OC_BAND,
      },
    ]);
    assertEquals(result.chosenOfferId, null);
  },
);

Deno.test(
  "resolveContestForCandidate picks the highest-scoring offer among competitors",
  () => {
    const candidate = coachCandidate({
      minimumThreshold: 30,
      marketTierPref: 100,
      philosophyFitPref: 0,
      staffFitPref: 0,
      compensationPref: 0,
    });
    const result = resolveContestForCandidate(candidate, [
      {
        franchise: franchise({ franchiseId: "small", marketTier: "small" }),
        offer: offer({ id: "small-offer" }),
        roleBand: OC_BAND,
      },
      {
        franchise: franchise({ franchiseId: "large", marketTier: "large" }),
        offer: offer({ id: "large-offer" }),
        roleBand: OC_BAND,
      },
      {
        franchise: franchise({ franchiseId: "mid", marketTier: "medium" }),
        offer: offer({ id: "mid-offer" }),
        roleBand: OC_BAND,
      },
    ]);
    assertEquals(result.chosenOfferId, "large-offer");
  },
);

Deno.test(
  "resolveContestForCandidate breaks score ties by higher compensation",
  () => {
    const candidate = coachCandidate({
      minimumThreshold: 20,
      marketTierPref: 100,
      philosophyFitPref: 0,
      staffFitPref: 0,
      compensationPref: 0,
    });
    // Two medium-tier offers — scores identical, compensation differs.
    const result = resolveContestForCandidate(candidate, [
      {
        franchise: franchise({ marketTier: "medium" }),
        offer: offer({ id: "cheap", salary: OC_BAND.min }),
        roleBand: OC_BAND,
      },
      {
        franchise: franchise({ marketTier: "medium" }),
        offer: offer({ id: "rich", salary: OC_BAND.max }),
        roleBand: OC_BAND,
      },
    ]);
    assertEquals(result.chosenOfferId, "rich");
  },
);

Deno.test(
  "resolveContestForCandidate uses the injected rng for deep ties",
  () => {
    const candidate = coachCandidate({
      minimumThreshold: 20,
      marketTierPref: 100,
      philosophyFitPref: 0,
      staffFitPref: 0,
      compensationPref: 0,
    });
    const fixtures = [
      {
        franchise: franchise({ marketTier: "medium" }),
        offer: offer({ id: "alpha", salary: 3_000_000 }),
        roleBand: OC_BAND,
      },
      {
        franchise: franchise({ marketTier: "medium" }),
        offer: offer({ id: "beta", salary: 3_000_000 }),
        roleBand: OC_BAND,
      },
    ];
    // rng = 0 → first, rng near 1 → last.
    const first = resolveContestForCandidate(candidate, fixtures, () => 0);
    const last = resolveContestForCandidate(
      candidate,
      fixtures,
      () => 0.9999,
    );
    assertEquals(first.chosenOfferId, "alpha");
    assertEquals(last.chosenOfferId, "beta");
  },
);

Deno.test(
  "resolveContestForCandidate returns null for empty offer list",
  () => {
    assertEquals(
      resolveContestForCandidate(coachCandidate(), []).chosenOfferId,
      null,
    );
  },
);

Deno.test(
  "resolveContestForCandidate works for scout candidates (no tendencies)",
  () => {
    const candidate = scoutCandidate({
      minimumThreshold: 20,
      marketTierPref: 80,
      philosophyFitPref: 0,
      staffFitPref: 0,
      compensationPref: 40,
    });
    const scoutBand = { min: 250_000, max: 800_000 };
    const result = resolveContestForCandidate(candidate, [
      {
        franchise: franchise({ marketTier: "large" }),
        offer: offer({ id: "big-market", salary: 500_000 }),
        roleBand: scoutBand,
      },
      {
        franchise: franchise({ marketTier: "small" }),
        offer: offer({ id: "small-market", salary: 800_000 }),
        roleBand: scoutBand,
      },
    ]);
    assertEquals(result.chosenOfferId, "big-market");
  },
);
