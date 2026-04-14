import { assertEquals } from "@std/assert";
import {
  PLAYER_ATTRIBUTE_KEYS,
  type PlayerAttributes,
  type SchemeFingerprint,
} from "@zone-blitz/shared";
import { bucketScore, computeSchemeFit, type PlayerForFit } from "./fit.ts";

function attributes(
  overrides: Partial<PlayerAttributes> = {},
): PlayerAttributes {
  const base: Partial<PlayerAttributes> = {};
  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    (base as Record<string, number>)[key] = 50;
    (base as Record<string, number>)[`${key}Potential`] = 50;
  }
  return { ...base, ...overrides } as PlayerAttributes;
}

function fingerprint(
  overrides: Partial<SchemeFingerprint> = {},
): SchemeFingerprint {
  return {
    offense: null,
    defense: null,
    overrides: {},
    ...overrides,
  };
}

Deno.test("bucketScore maps the 5 bands documented in ADR 0005", () => {
  assertEquals(bucketScore(95), "ideal");
  assertEquals(bucketScore(85), "ideal");
  assertEquals(bucketScore(70), "fits");
  assertEquals(bucketScore(50), "neutral");
  assertEquals(bucketScore(30), "poor");
  assertEquals(bucketScore(5), "miscast");
});

Deno.test(
  "computeSchemeFit returns neutral when the player's position has no demands defined",
  () => {
    const player: PlayerForFit = {
      neutralBucket: "K",
      attributes: attributes(),
    };
    const fp = fingerprint({
      defense: {
        frontOddEven: 50,
        gapResponsibility: 50,
        subPackageLean: 50,
        coverageManZone: 20,
        coverageShell: 50,
        cornerPressOff: 20,
        pressureRate: 50,
        disguiseRate: 50,
      },
    });
    assertEquals(computeSchemeFit(player, fp), "neutral");
  },
);

Deno.test(
  "computeSchemeFit returns neutral when the fingerprint side is null",
  () => {
    const player: PlayerForFit = {
      neutralBucket: "CB",
      attributes: attributes({ manCoverage: 90, speed: 90 }),
    };
    assertEquals(computeSchemeFit(player, fingerprint()), "neutral");
  },
);

Deno.test(
  "computeSchemeFit returns neutral when every axis is centered (no polarization)",
  () => {
    const player: PlayerForFit = {
      neutralBucket: "CB",
      attributes: attributes({
        manCoverage: 90,
        zoneCoverage: 90,
        speed: 90,
      }),
    };
    const fp = fingerprint({
      defense: {
        frontOddEven: 50,
        gapResponsibility: 50,
        subPackageLean: 50,
        coverageManZone: 50,
        coverageShell: 50,
        cornerPressOff: 50,
        pressureRate: 50,
        disguiseRate: 50,
      },
    });
    assertEquals(computeSchemeFit(player, fp), "neutral");
  },
);

Deno.test(
  "computeSchemeFit rewards a man-coverage CB in a press-man defense",
  () => {
    const player: PlayerForFit = {
      neutralBucket: "CB",
      attributes: attributes({
        manCoverage: 95,
        speed: 95,
        agility: 90,
        strength: 85,
        jumping: 85,
      }),
    };
    const fp = fingerprint({
      defense: {
        frontOddEven: 50,
        gapResponsibility: 50,
        subPackageLean: 50,
        coverageManZone: 5, // strongly man
        coverageShell: 50,
        cornerPressOff: 5, // strongly press
        pressureRate: 50,
        disguiseRate: 50,
      },
    });
    const label = computeSchemeFit(player, fp);
    assertEquals(label === "ideal" || label === "fits", true);
  },
);

Deno.test(
  "computeSchemeFit flags a zone-only CB dropped into a heavy man scheme as poor/miscast",
  () => {
    const player: PlayerForFit = {
      neutralBucket: "CB",
      attributes: attributes({
        manCoverage: 20,
        speed: 25,
        agility: 25,
        strength: 30,
        zoneCoverage: 95,
        footballIq: 95,
        anticipation: 95,
      }),
    };
    const fp = fingerprint({
      defense: {
        frontOddEven: 50,
        gapResponsibility: 50,
        subPackageLean: 50,
        coverageManZone: 5,
        coverageShell: 50,
        cornerPressOff: 5,
        pressureRate: 50,
        disguiseRate: 50,
      },
    });
    const label = computeSchemeFit(player, fp);
    assertEquals(
      label === "poor" || label === "miscast",
      true,
      `expected poor/miscast, got ${label}`,
    );
  },
);

Deno.test(
  "computeSchemeFit swings from poor to ideal for the same player when the scheme flips",
  () => {
    const zoneCB: PlayerForFit = {
      neutralBucket: "CB",
      attributes: attributes({
        zoneCoverage: 95,
        footballIq: 95,
        anticipation: 95,
        speed: 95,
        manCoverage: 20,
        agility: 40,
        strength: 40,
      }),
    };
    const manScheme = fingerprint({
      defense: {
        frontOddEven: 50,
        gapResponsibility: 50,
        subPackageLean: 50,
        coverageManZone: 5,
        coverageShell: 50,
        cornerPressOff: 5,
        pressureRate: 50,
        disguiseRate: 50,
      },
    });
    const zoneScheme = fingerprint({
      defense: {
        frontOddEven: 50,
        gapResponsibility: 50,
        subPackageLean: 50,
        coverageManZone: 95,
        coverageShell: 50,
        cornerPressOff: 95,
        pressureRate: 50,
        disguiseRate: 50,
      },
    });
    const inMan = computeSchemeFit(zoneCB, manScheme);
    const inZone = computeSchemeFit(zoneCB, zoneScheme);
    // Reassignment of the same player through a different scheme
    // must move the label — the premise of the whole compute-on-read
    // design.
    assertEquals(inMan === inZone, false);
  },
);

Deno.test("computeSchemeFit ignores the wrong-side tendency vector", () => {
  // An offensive fingerprint should not impact a CB fit label.
  const player: PlayerForFit = {
    neutralBucket: "CB",
    attributes: attributes({ manCoverage: 99, speed: 99 }),
  };
  const fp = fingerprint({
    offense: {
      runPassLean: 5,
      tempo: 5,
      personnelWeight: 5,
      formationUnderCenterShotgun: 5,
      preSnapMotionRate: 5,
      passingStyle: 5,
      passingDepth: 5,
      runGameBlocking: 5,
      rpoIntegration: 5,
    },
  });
  assertEquals(computeSchemeFit(player, fp), "neutral");
});
