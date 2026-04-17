import { assertEquals } from "@std/assert";
import {
  NEUTRAL_BUCKETS,
  neutralBucket,
  type NeutralBucketInput,
} from "./neutral-bucket.ts";
import {
  PLAYER_ATTRIBUTE_KEYS,
  type PlayerAttributes,
} from "../types/player-attributes.ts";

const BASELINE = 30;

function makeAttributes(
  overrides: Partial<PlayerAttributes> = {},
): PlayerAttributes {
  const base: Record<string, number> = {};
  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    base[key] = BASELINE;
    base[`${key}Potential`] = BASELINE;
  }
  return { ...(base as PlayerAttributes), ...overrides };
}

function input(
  overrides: Partial<PlayerAttributes>,
  heightInches: number,
  weightPounds: number,
): NeutralBucketInput {
  return {
    attributes: makeAttributes(overrides),
    heightInches,
    weightPounds,
  };
}

Deno.test("neutralBucket exposes all 14 buckets", () => {
  assertEquals(NEUTRAL_BUCKETS.length, 14);
  assertEquals(new Set(NEUTRAL_BUCKETS).size, 14);
});

Deno.test("classifies a pocket QB by signature", () => {
  const bucket = neutralBucket(
    input(
      {
        armStrength: 85,
        accuracyShort: 80,
        accuracyMedium: 80,
        accuracyDeep: 78,
        release: 80,
        decisionMaking: 80,
      },
      75,
      225,
    ),
  );
  assertEquals(bucket, "QB");
});

Deno.test("classifies a workhorse RB", () => {
  const bucket = neutralBucket(
    input(
      { ballCarrying: 85, elusiveness: 80, acceleration: 85, speed: 85 },
      70,
      215,
    ),
  );
  assertEquals(bucket, "RB");
});

Deno.test("classifies a field-stretching WR", () => {
  const bucket = neutralBucket(
    input(
      { routeRunning: 85, catching: 85, speed: 85, acceleration: 85 },
      73,
      200,
    ),
  );
  assertEquals(bucket, "WR");
});

Deno.test("classifies a dual-threat TE", () => {
  const bucket = neutralBucket(
    input(
      { catching: 80, runBlocking: 75, passBlocking: 75 },
      77,
      250,
    ),
  );
  assertEquals(bucket, "TE");
});

Deno.test("classifies a franchise OT by height + blocking", () => {
  const bucket = neutralBucket(
    input(
      { passBlocking: 85, runBlocking: 80, agility: 70 },
      78,
      315,
    ),
  );
  assertEquals(bucket, "OT");
});

Deno.test("OT gate: same blocker, too short, classifies as IOL", () => {
  const bucket = neutralBucket(
    input(
      { passBlocking: 85, runBlocking: 80, agility: 70, strength: 75 },
      73,
      315,
    ),
  );
  assertEquals(bucket, "IOL");
});

Deno.test(
  "IOL gate: OT-height blocker with IOL-ish attrs still classifies as OT",
  () => {
    // An OT-sized player (h≥77) must not qualify as IOL — otherwise the
    // two buckets tie on shared classifier sig attrs and the generator's
    // lockInBucket loop inflates OT attributes unbounded.
    const bucket = neutralBucket(
      input(
        { runBlocking: 60, passBlocking: 60, strength: 60, agility: 40 },
        78,
        315,
      ),
    );
    assertEquals(bucket, "OT");
  },
);

Deno.test("classifies a power-scheme IOL", () => {
  const bucket = neutralBucket(
    input(
      { runBlocking: 85, passBlocking: 78, strength: 85 },
      74,
      315,
    ),
  );
  assertEquals(bucket, "IOL");
});

Deno.test("classifies a speed-rushing EDGE", () => {
  const bucket = neutralBucket(
    input(
      { passRushing: 85, acceleration: 85, blockShedding: 75, speed: 80 },
      76,
      260,
    ),
  );
  assertEquals(bucket, "EDGE");
});

Deno.test("classifies a run-stuffing IDL", () => {
  const bucket = neutralBucket(
    input(
      { strength: 85, blockShedding: 80, runDefense: 85, passRushing: 70 },
      74,
      310,
    ),
  );
  assertEquals(bucket, "IDL");
});

Deno.test("classifies a rangy LB", () => {
  const bucket = neutralBucket(
    input(
      { tackling: 85, runDefense: 80, zoneCoverage: 75, footballIq: 80 },
      73,
      235,
    ),
  );
  assertEquals(bucket, "LB");
});

Deno.test("classifies a press-man CB", () => {
  const bucket = neutralBucket(
    input(
      { manCoverage: 85, zoneCoverage: 75, speed: 85, agility: 80 },
      72,
      195,
    ),
  );
  assertEquals(bucket, "CB");
});

Deno.test("classifies a centerfield S", () => {
  const bucket = neutralBucket(
    input(
      {
        zoneCoverage: 85,
        tackling: 75,
        footballIq: 80,
        anticipation: 85,
      },
      73,
      210,
    ),
  );
  assertEquals(bucket, "S");
});

Deno.test("classifies a kicker when specialist gate clears", () => {
  const bucket = neutralBucket(
    input({ kickingPower: 80, kickingAccuracy: 85 }, 72, 200),
  );
  assertEquals(bucket, "K");
});

Deno.test("low kicking accuracy fails specialist gate", () => {
  const bucket = neutralBucket(
    input(
      {
        kickingPower: 80,
        kickingAccuracy: 20,
        zoneCoverage: 50,
        tackling: 50,
        footballIq: 50,
        anticipation: 50,
      },
      72,
      210,
    ),
  );
  assertEquals(bucket !== "K", true);
});

Deno.test("classifies a punter when specialist gate clears", () => {
  const bucket = neutralBucket(
    input({ puntingPower: 82, puntingAccuracy: 80 }, 73, 210),
  );
  assertEquals(bucket, "P");
});

Deno.test("classifies a long-snapper when snap accuracy clears", () => {
  const bucket = neutralBucket(
    input({ snapAccuracy: 85 }, 74, 240),
  );
  assertEquals(bucket, "LS");
});

Deno.test("specialists-first: elite snap accuracy wins over TE profile", () => {
  const bucket = neutralBucket(
    input(
      {
        snapAccuracy: 85,
        catching: 80,
        runBlocking: 80,
        passBlocking: 80,
      },
      76,
      245,
    ),
  );
  assertEquals(bucket, "LS");
});

Deno.test("tie-break priority: TE outranks RB at equal signature means", () => {
  const bucket = neutralBucket(
    input(
      {
        catching: 60,
        runBlocking: 60,
        passBlocking: 60,
        ballCarrying: 60,
        elusiveness: 60,
        acceleration: 60,
        speed: 60,
      },
      74,
      240,
    ),
  );
  assertEquals(bucket, "TE");
});

Deno.test("deterministic: same input yields same output", () => {
  const sample = input(
    { armStrength: 72, accuracyShort: 70, accuracyMedium: 70 },
    75,
    220,
  );
  assertEquals(neutralBucket(sample), neutralBucket(sample));
});

Deno.test("falls back to QB when all size-gated buckets are disqualified", () => {
  const bucket = neutralBucket(
    input({ armStrength: 60, accuracyShort: 55 }, 76, 400),
  );
  assertEquals(bucket, "QB");
});
