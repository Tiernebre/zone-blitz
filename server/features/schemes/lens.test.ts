import { assertEquals } from "@std/assert";
import {
  PLAYER_ATTRIBUTE_KEYS,
  type PlayerAttributes,
  type SchemeFingerprint,
} from "@zone-blitz/shared";
import { type PlayerForLens, schemeLens } from "./lens.ts";

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

// --- Specialists return null ---

Deno.test("schemeLens returns null for kicker", () => {
  const player: PlayerForLens = {
    neutralBucket: "K",
    attributes: attributes(),
  };
  assertEquals(schemeLens(player, fingerprint()), null);
});

Deno.test("schemeLens returns null for punter", () => {
  const player: PlayerForLens = {
    neutralBucket: "P",
    attributes: attributes(),
  };
  assertEquals(schemeLens(player, fingerprint()), null);
});

Deno.test("schemeLens returns null for long snapper", () => {
  const player: PlayerForLens = {
    neutralBucket: "LS",
    attributes: attributes(),
  };
  assertEquals(schemeLens(player, fingerprint()), null);
});

// --- Null when relevant side has no coordinator ---

Deno.test("schemeLens returns null for offensive player when no OC hired", () => {
  const player: PlayerForLens = {
    neutralBucket: "QB",
    attributes: attributes(),
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
  assertEquals(schemeLens(player, fp), null);
});

Deno.test("schemeLens returns null for defensive player when no DC hired", () => {
  const player: PlayerForLens = {
    neutralBucket: "CB",
    attributes: attributes(),
  };
  const fp = fingerprint({
    offense: {
      runPassLean: 50,
      tempo: 50,
      personnelWeight: 50,
      formationUnderCenterShotgun: 50,
      preSnapMotionRate: 50,
      passingStyle: 50,
      passingDepth: 50,
      runGameBlocking: 50,
      rpoIntegration: 50,
    },
  });
  assertEquals(schemeLens(player, fp), null);
});

// --- QB archetypes ---

Deno.test("schemeLens maps QB to pocket passer in timing + short scheme", () => {
  const player: PlayerForLens = {
    neutralBucket: "QB",
    attributes: attributes(),
  };
  const fp = fingerprint({
    offense: {
      runPassLean: 50,
      tempo: 50,
      personnelWeight: 50,
      formationUnderCenterShotgun: 20,
      preSnapMotionRate: 50,
      passingStyle: 15,
      passingDepth: 20,
      runGameBlocking: 50,
      rpoIntegration: 20,
    },
  });
  assertEquals(schemeLens(player, fp), "pocket passer");
});

Deno.test("schemeLens maps QB to dual-threat in improvisation + RPO scheme", () => {
  const player: PlayerForLens = {
    neutralBucket: "QB",
    attributes: attributes(),
  };
  const fp = fingerprint({
    offense: {
      runPassLean: 50,
      tempo: 50,
      personnelWeight: 50,
      formationUnderCenterShotgun: 80,
      preSnapMotionRate: 50,
      passingStyle: 85,
      passingDepth: 50,
      runGameBlocking: 50,
      rpoIntegration: 80,
    },
  });
  assertEquals(schemeLens(player, fp), "dual-threat QB");
});

Deno.test("schemeLens maps QB to gunslinger in deep passing scheme", () => {
  const player: PlayerForLens = {
    neutralBucket: "QB",
    attributes: attributes(),
  };
  const fp = fingerprint({
    offense: {
      runPassLean: 50,
      tempo: 50,
      personnelWeight: 50,
      formationUnderCenterShotgun: 50,
      preSnapMotionRate: 50,
      passingStyle: 50,
      passingDepth: 90,
      runGameBlocking: 50,
      rpoIntegration: 20,
    },
  });
  assertEquals(schemeLens(player, fp), "gunslinger");
});

// --- RB archetypes ---

Deno.test("schemeLens maps RB to zone RB in zone-blocking scheme", () => {
  const player: PlayerForLens = {
    neutralBucket: "RB",
    attributes: attributes(),
  };
  const fp = fingerprint({
    offense: {
      runPassLean: 30,
      tempo: 50,
      personnelWeight: 50,
      formationUnderCenterShotgun: 50,
      preSnapMotionRate: 50,
      passingStyle: 50,
      passingDepth: 50,
      runGameBlocking: 15,
      rpoIntegration: 50,
    },
  });
  assertEquals(schemeLens(player, fp), "zone RB");
});

Deno.test("schemeLens maps RB to power RB in gap/power scheme", () => {
  const player: PlayerForLens = {
    neutralBucket: "RB",
    attributes: attributes(),
  };
  const fp = fingerprint({
    offense: {
      runPassLean: 30,
      tempo: 50,
      personnelWeight: 50,
      formationUnderCenterShotgun: 50,
      preSnapMotionRate: 50,
      passingStyle: 50,
      passingDepth: 50,
      runGameBlocking: 85,
      rpoIntegration: 50,
    },
  });
  assertEquals(schemeLens(player, fp), "power RB");
});

Deno.test("schemeLens maps RB to receiving RB in pass-heavy scheme", () => {
  const player: PlayerForLens = {
    neutralBucket: "RB",
    attributes: attributes(),
  };
  const fp = fingerprint({
    offense: {
      runPassLean: 85,
      tempo: 50,
      personnelWeight: 50,
      formationUnderCenterShotgun: 50,
      preSnapMotionRate: 50,
      passingStyle: 50,
      passingDepth: 50,
      runGameBlocking: 50,
      rpoIntegration: 50,
    },
  });
  assertEquals(schemeLens(player, fp), "receiving RB");
});

// --- WR archetypes ---

Deno.test("schemeLens maps WR to X receiver in vertical scheme", () => {
  const player: PlayerForLens = {
    neutralBucket: "WR",
    attributes: attributes(),
  };
  const fp = fingerprint({
    offense: {
      runPassLean: 50,
      tempo: 50,
      personnelWeight: 50,
      formationUnderCenterShotgun: 50,
      preSnapMotionRate: 30,
      passingStyle: 50,
      passingDepth: 85,
      runGameBlocking: 50,
      rpoIntegration: 50,
    },
  });
  assertEquals(schemeLens(player, fp), "X receiver");
});

Deno.test("schemeLens maps WR to slot receiver in short-pass + motion scheme", () => {
  const player: PlayerForLens = {
    neutralBucket: "WR",
    attributes: attributes(),
  };
  const fp = fingerprint({
    offense: {
      runPassLean: 50,
      tempo: 50,
      personnelWeight: 50,
      formationUnderCenterShotgun: 50,
      preSnapMotionRate: 80,
      passingStyle: 50,
      passingDepth: 15,
      runGameBlocking: 50,
      rpoIntegration: 50,
    },
  });
  assertEquals(schemeLens(player, fp), "slot receiver");
});

Deno.test("schemeLens maps WR to possession receiver in short-pass scheme", () => {
  const player: PlayerForLens = {
    neutralBucket: "WR",
    attributes: attributes(),
  };
  const fp = fingerprint({
    offense: {
      runPassLean: 50,
      tempo: 50,
      personnelWeight: 50,
      formationUnderCenterShotgun: 50,
      preSnapMotionRate: 30,
      passingStyle: 50,
      passingDepth: 15,
      runGameBlocking: 50,
      rpoIntegration: 50,
    },
  });
  assertEquals(schemeLens(player, fp), "possession receiver");
});

// --- TE archetypes ---

Deno.test("schemeLens maps TE to blocking TE in heavy personnel", () => {
  const player: PlayerForLens = {
    neutralBucket: "TE",
    attributes: attributes(),
  };
  const fp = fingerprint({
    offense: {
      runPassLean: 50,
      tempo: 50,
      personnelWeight: 85,
      formationUnderCenterShotgun: 50,
      preSnapMotionRate: 50,
      passingStyle: 50,
      passingDepth: 50,
      runGameBlocking: 50,
      rpoIntegration: 50,
    },
  });
  assertEquals(schemeLens(player, fp), "blocking TE");
});

Deno.test("schemeLens maps TE to move TE in light personnel", () => {
  const player: PlayerForLens = {
    neutralBucket: "TE",
    attributes: attributes(),
  };
  const fp = fingerprint({
    offense: {
      runPassLean: 50,
      tempo: 50,
      personnelWeight: 15,
      formationUnderCenterShotgun: 50,
      preSnapMotionRate: 50,
      passingStyle: 50,
      passingDepth: 50,
      runGameBlocking: 50,
      rpoIntegration: 50,
    },
  });
  assertEquals(schemeLens(player, fp), "move TE");
});

// --- OL archetypes ---

Deno.test("schemeLens maps OT to zone OT in zone-blocking scheme", () => {
  const player: PlayerForLens = {
    neutralBucket: "OT",
    attributes: attributes(),
  };
  const fp = fingerprint({
    offense: {
      runPassLean: 50,
      tempo: 50,
      personnelWeight: 50,
      formationUnderCenterShotgun: 50,
      preSnapMotionRate: 50,
      passingStyle: 50,
      passingDepth: 50,
      runGameBlocking: 15,
      rpoIntegration: 50,
    },
  });
  assertEquals(schemeLens(player, fp), "zone OT");
});

Deno.test("schemeLens maps OT to power OT in gap/power scheme", () => {
  const player: PlayerForLens = {
    neutralBucket: "OT",
    attributes: attributes(),
  };
  const fp = fingerprint({
    offense: {
      runPassLean: 50,
      tempo: 50,
      personnelWeight: 50,
      formationUnderCenterShotgun: 50,
      preSnapMotionRate: 50,
      passingStyle: 50,
      passingDepth: 50,
      runGameBlocking: 85,
      rpoIntegration: 50,
    },
  });
  assertEquals(schemeLens(player, fp), "power OT");
});

Deno.test("schemeLens maps IOL to zone guard in zone-blocking scheme", () => {
  const player: PlayerForLens = {
    neutralBucket: "IOL",
    attributes: attributes(),
  };
  const fp = fingerprint({
    offense: {
      runPassLean: 50,
      tempo: 50,
      personnelWeight: 50,
      formationUnderCenterShotgun: 50,
      preSnapMotionRate: 50,
      passingStyle: 50,
      passingDepth: 50,
      runGameBlocking: 15,
      rpoIntegration: 50,
    },
  });
  assertEquals(schemeLens(player, fp), "zone guard");
});

Deno.test("schemeLens maps IOL to power guard in gap/power scheme", () => {
  const player: PlayerForLens = {
    neutralBucket: "IOL",
    attributes: attributes(),
  };
  const fp = fingerprint({
    offense: {
      runPassLean: 50,
      tempo: 50,
      personnelWeight: 50,
      formationUnderCenterShotgun: 50,
      preSnapMotionRate: 50,
      passingStyle: 50,
      passingDepth: 50,
      runGameBlocking: 85,
      rpoIntegration: 50,
    },
  });
  assertEquals(schemeLens(player, fp), "power guard");
});

// --- Defensive archetypes ---

Deno.test("schemeLens maps EDGE to stand-up OLB in odd front", () => {
  const player: PlayerForLens = {
    neutralBucket: "EDGE",
    attributes: attributes(),
  };
  const fp = fingerprint({
    defense: {
      frontOddEven: 15,
      gapResponsibility: 50,
      subPackageLean: 50,
      coverageManZone: 50,
      coverageShell: 50,
      cornerPressOff: 50,
      pressureRate: 50,
      disguiseRate: 50,
    },
  });
  assertEquals(schemeLens(player, fp), "stand-up OLB");
});

Deno.test("schemeLens maps EDGE to speed DE in even front", () => {
  const player: PlayerForLens = {
    neutralBucket: "EDGE",
    attributes: attributes(),
  };
  const fp = fingerprint({
    defense: {
      frontOddEven: 85,
      gapResponsibility: 50,
      subPackageLean: 50,
      coverageManZone: 50,
      coverageShell: 50,
      cornerPressOff: 50,
      pressureRate: 50,
      disguiseRate: 50,
    },
  });
  assertEquals(schemeLens(player, fp), "speed DE");
});

Deno.test("schemeLens maps IDL to nose tackle in odd front", () => {
  const player: PlayerForLens = {
    neutralBucket: "IDL",
    attributes: attributes(),
  };
  const fp = fingerprint({
    defense: {
      frontOddEven: 15,
      gapResponsibility: 50,
      subPackageLean: 50,
      coverageManZone: 50,
      coverageShell: 50,
      cornerPressOff: 50,
      pressureRate: 50,
      disguiseRate: 50,
    },
  });
  assertEquals(schemeLens(player, fp), "nose tackle");
});

Deno.test("schemeLens maps IDL to 3-tech in even + one-gap front", () => {
  const player: PlayerForLens = {
    neutralBucket: "IDL",
    attributes: attributes(),
  };
  const fp = fingerprint({
    defense: {
      frontOddEven: 85,
      gapResponsibility: 15,
      subPackageLean: 50,
      coverageManZone: 50,
      coverageShell: 50,
      cornerPressOff: 50,
      pressureRate: 50,
      disguiseRate: 50,
    },
  });
  assertEquals(schemeLens(player, fp), "3-tech");
});

Deno.test("schemeLens maps LB to run-stuff LB in base-heavy scheme", () => {
  const player: PlayerForLens = {
    neutralBucket: "LB",
    attributes: attributes(),
  };
  const fp = fingerprint({
    defense: {
      frontOddEven: 50,
      gapResponsibility: 50,
      subPackageLean: 15,
      coverageManZone: 50,
      coverageShell: 50,
      cornerPressOff: 50,
      pressureRate: 50,
      disguiseRate: 50,
    },
  });
  assertEquals(schemeLens(player, fp), "run-stuff LB");
});

Deno.test("schemeLens maps LB to coverage LB in sub-package scheme", () => {
  const player: PlayerForLens = {
    neutralBucket: "LB",
    attributes: attributes(),
  };
  const fp = fingerprint({
    defense: {
      frontOddEven: 50,
      gapResponsibility: 50,
      subPackageLean: 85,
      coverageManZone: 50,
      coverageShell: 50,
      cornerPressOff: 50,
      pressureRate: 50,
      disguiseRate: 50,
    },
  });
  assertEquals(schemeLens(player, fp), "coverage LB");
});

// --- CB archetypes ---

Deno.test("schemeLens maps CB to press-man CB in man + press scheme", () => {
  const player: PlayerForLens = {
    neutralBucket: "CB",
    attributes: attributes(),
  };
  const fp = fingerprint({
    defense: {
      frontOddEven: 50,
      gapResponsibility: 50,
      subPackageLean: 50,
      coverageManZone: 10,
      coverageShell: 50,
      cornerPressOff: 10,
      pressureRate: 50,
      disguiseRate: 50,
    },
  });
  assertEquals(schemeLens(player, fp), "press-man CB");
});

Deno.test("schemeLens maps CB to zone CB in zone + off scheme", () => {
  const player: PlayerForLens = {
    neutralBucket: "CB",
    attributes: attributes(),
  };
  const fp = fingerprint({
    defense: {
      frontOddEven: 50,
      gapResponsibility: 50,
      subPackageLean: 50,
      coverageManZone: 90,
      coverageShell: 50,
      cornerPressOff: 90,
      pressureRate: 50,
      disguiseRate: 50,
    },
  });
  assertEquals(schemeLens(player, fp), "zone CB");
});

Deno.test("schemeLens maps CB to slot CB in sub-package-heavy scheme", () => {
  const player: PlayerForLens = {
    neutralBucket: "CB",
    attributes: attributes(),
  };
  const fp = fingerprint({
    defense: {
      frontOddEven: 50,
      gapResponsibility: 50,
      subPackageLean: 90,
      coverageManZone: 50,
      coverageShell: 50,
      cornerPressOff: 50,
      pressureRate: 50,
      disguiseRate: 50,
    },
  });
  assertEquals(schemeLens(player, fp), "slot CB");
});

// --- S archetypes ---

Deno.test("schemeLens maps S to box safety in single-high scheme", () => {
  const player: PlayerForLens = {
    neutralBucket: "S",
    attributes: attributes(),
  };
  const fp = fingerprint({
    defense: {
      frontOddEven: 50,
      gapResponsibility: 50,
      subPackageLean: 50,
      coverageManZone: 50,
      coverageShell: 10,
      cornerPressOff: 50,
      pressureRate: 50,
      disguiseRate: 50,
    },
  });
  assertEquals(schemeLens(player, fp), "box safety");
});

Deno.test("schemeLens maps S to free safety in two-high scheme", () => {
  const player: PlayerForLens = {
    neutralBucket: "S",
    attributes: attributes(),
  };
  const fp = fingerprint({
    defense: {
      frontOddEven: 50,
      gapResponsibility: 50,
      subPackageLean: 50,
      coverageManZone: 50,
      coverageShell: 90,
      cornerPressOff: 50,
      pressureRate: 50,
      disguiseRate: 50,
    },
  });
  assertEquals(schemeLens(player, fp), "free safety");
});

// --- Neutral axes default to a sensible archetype ---

Deno.test("schemeLens returns a default archetype when all axes are centered", () => {
  const player: PlayerForLens = {
    neutralBucket: "QB",
    attributes: attributes(),
  };
  const fp = fingerprint({
    offense: {
      runPassLean: 50,
      tempo: 50,
      personnelWeight: 50,
      formationUnderCenterShotgun: 50,
      preSnapMotionRate: 50,
      passingStyle: 50,
      passingDepth: 50,
      runGameBlocking: 50,
      rpoIntegration: 50,
    },
  });
  const result = schemeLens(player, fp);
  assertEquals(result !== null, true, "should return an archetype, not null");
  assertEquals(result, "pocket passer");
});

// --- Scheme lens recomputes when fingerprint changes ---

Deno.test("schemeLens shifts CB archetype when scheme flips from man to zone", () => {
  const player: PlayerForLens = {
    neutralBucket: "CB",
    attributes: attributes(),
  };
  const manScheme = fingerprint({
    defense: {
      frontOddEven: 50,
      gapResponsibility: 50,
      subPackageLean: 30,
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
      subPackageLean: 30,
      coverageManZone: 95,
      coverageShell: 50,
      cornerPressOff: 95,
      pressureRate: 50,
      disguiseRate: 50,
    },
  });
  assertEquals(schemeLens(player, manScheme), "press-man CB");
  assertEquals(schemeLens(player, zoneScheme), "zone CB");
});
