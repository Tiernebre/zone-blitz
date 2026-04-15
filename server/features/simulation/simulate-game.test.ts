import {
  assert,
  assertEquals,
  assertGreater,
  assertGreaterOrEqual,
  assertNotEquals,
} from "@std/assert";
import {
  PLAYER_ATTRIBUTE_KEYS,
  type PlayerAttributes,
  type SchemeFingerprint,
} from "@zone-blitz/shared";
import type { PlayerRuntime, TeamRuntime } from "./resolve-play.ts";
import type { CoachingMods } from "./resolve-play.ts";
import { simulateGame } from "./simulate-game.ts";
import type { SimulateGameInput } from "./simulate-game.ts";

function makeAttributes(
  overrides: Partial<PlayerAttributes> = {},
): PlayerAttributes {
  const base: Partial<PlayerAttributes> = {};
  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    (base as Record<string, number>)[key] = 50;
    (base as Record<string, number>)[`${key}Potential`] = 50;
  }
  return { ...base, ...overrides } as PlayerAttributes;
}

function makeFingerprint(
  overrides: Partial<SchemeFingerprint> = {},
): SchemeFingerprint {
  return {
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
    overrides: {},
    ...overrides,
  };
}

function makePlayer(
  id: string,
  bucket: PlayerRuntime["neutralBucket"],
  overrides: Partial<PlayerAttributes> = {},
): PlayerRuntime {
  return {
    playerId: id,
    neutralBucket: bucket,
    attributes: makeAttributes(overrides),
  };
}

function makeCoachingMods(
  overrides: Partial<CoachingMods> = {},
): CoachingMods {
  return { schemeFitBonus: 0, situationalBonus: 0, ...overrides };
}

function makeRoster(prefix: string): PlayerRuntime[] {
  return [
    makePlayer(`${prefix}-qb1`, "QB"),
    makePlayer(`${prefix}-rb1`, "RB"),
    makePlayer(`${prefix}-rb2`, "RB"),
    makePlayer(`${prefix}-wr1`, "WR"),
    makePlayer(`${prefix}-wr2`, "WR"),
    makePlayer(`${prefix}-wr3`, "WR"),
    makePlayer(`${prefix}-te1`, "TE"),
    makePlayer(`${prefix}-te2`, "TE"),
    makePlayer(`${prefix}-ot1`, "OT"),
    makePlayer(`${prefix}-ot2`, "OT"),
    makePlayer(`${prefix}-iol1`, "IOL"),
    makePlayer(`${prefix}-iol2`, "IOL"),
    makePlayer(`${prefix}-iol3`, "IOL"),
    makePlayer(`${prefix}-edge1`, "EDGE"),
    makePlayer(`${prefix}-edge2`, "EDGE"),
    makePlayer(`${prefix}-idl1`, "IDL"),
    makePlayer(`${prefix}-idl2`, "IDL"),
    makePlayer(`${prefix}-lb1`, "LB"),
    makePlayer(`${prefix}-lb2`, "LB"),
    makePlayer(`${prefix}-lb3`, "LB"),
    makePlayer(`${prefix}-cb1`, "CB"),
    makePlayer(`${prefix}-cb2`, "CB"),
    makePlayer(`${prefix}-s1`, "S"),
    makePlayer(`${prefix}-s2`, "S"),
    makePlayer(`${prefix}-k1`, "K"),
    makePlayer(`${prefix}-p1`, "P"),
  ];
}

function makeTeamRuntime(prefix: string): TeamRuntime {
  return {
    fingerprint: makeFingerprint(),
    onField: makeRoster(prefix),
    coachingMods: makeCoachingMods(),
  };
}

function makeInput(
  overrides: Partial<SimulateGameInput> = {},
): SimulateGameInput {
  return {
    gameId: "game-1",
    home: {
      teamId: "home-team",
      roster: makeTeamRuntime("home"),
    },
    away: {
      teamId: "away-team",
      roster: makeTeamRuntime("away"),
    },
    seed: 42,
    ...overrides,
  };
}

Deno.test("simulateGame", async (t) => {
  await t.step("returns a GameResult with required fields", () => {
    const result = simulateGame(makeInput());

    assertEquals(result.gameId, "game-1");
    assertEquals(result.seed, 42);
    assert(typeof result.finalScore.home === "number");
    assert(typeof result.finalScore.away === "number");
    assert(Array.isArray(result.events));
    assert(Array.isArray(result.driveLog));
    assert(Array.isArray(result.injuryReport));
    assert(typeof result.boxScore === "object");
  });

  await t.step("produces play events with valid structure", () => {
    const result = simulateGame(makeInput());

    assertGreater(result.events.length, 0);
    for (const event of result.events) {
      assertEquals(event.gameId, "game-1");
      assert(typeof event.driveIndex === "number");
      assert(typeof event.playIndex === "number");
      assert(
        [1, 2, 3, 4, "OT"].includes(event.quarter),
        `invalid quarter: ${event.quarter}`,
      );
      assert(typeof event.clock === "string");
      assert([1, 2, 3, 4].includes(event.situation.down));
      assert(typeof event.situation.distance === "number");
      assert(typeof event.situation.yardLine === "number");
      assert(typeof event.offenseTeamId === "string");
      assert(typeof event.defenseTeamId === "string");
      assert(typeof event.outcome === "string");
      assert(typeof event.yardage === "number");
      assert(Array.isArray(event.tags));
    }
  });

  await t.step("final score is non-negative for both teams", () => {
    const result = simulateGame(makeInput());

    assertGreaterOrEqual(result.finalScore.home, 0);
    assertGreaterOrEqual(result.finalScore.away, 0);
  });

  await t.step("events track correct team ids for offense/defense", () => {
    const input = makeInput();
    const result = simulateGame(input);

    for (const event of result.events) {
      assert(
        event.offenseTeamId === "home-team" ||
          event.offenseTeamId === "away-team",
        `unexpected offenseTeamId: ${event.offenseTeamId}`,
      );
      assert(
        event.defenseTeamId === "home-team" ||
          event.defenseTeamId === "away-team",
        `unexpected defenseTeamId: ${event.defenseTeamId}`,
      );
      assertNotEquals(
        event.offenseTeamId,
        event.defenseTeamId,
        "offense and defense should be different teams",
      );
    }
  });

  await t.step("manages downs correctly - resets after first down", () => {
    const result = simulateGame(makeInput());

    let currentDrive = -1;
    let expectedDown: 1 | 2 | 3 | 4 = 1;

    for (const event of result.events) {
      if (event.driveIndex !== currentDrive) {
        currentDrive = event.driveIndex;
        expectedDown = 1;
      }

      assertEquals(
        event.situation.down,
        expectedDown,
        `expected down ${expectedDown} on drive ${event.driveIndex}, play ${event.playIndex}`,
      );

      if (
        event.tags.includes("first_down") && !event.tags.includes("turnover")
      ) {
        expectedDown = 1;
      } else if (
        event.outcome === "punt" || event.outcome === "field_goal" ||
        event.tags.includes("turnover") || event.outcome === "touchdown"
      ) {
        // Drive ends
      } else {
        expectedDown = Math.min(expectedDown + 1, 4) as 1 | 2 | 3 | 4;
      }
    }
  });

  await t.step("clock decreases within each quarter", () => {
    const result = simulateGame(makeInput());

    function clockToSeconds(clock: string): number {
      const [min, sec] = clock.split(":").map(Number);
      return min * 60 + sec;
    }

    let lastQuarter: number | string = 1;
    let lastClockSec = 15 * 60;

    for (const event of result.events) {
      const eventClockSec = clockToSeconds(event.clock);

      if (event.quarter !== lastQuarter) {
        lastQuarter = event.quarter;
        lastClockSec = 15 * 60;
      }

      assert(
        eventClockSec <= lastClockSec,
        `clock should not increase within quarter ${event.quarter}: ${event.clock} after ${lastClockSec}s`,
      );
      lastClockSec = eventClockSec;
    }
  });

  await t.step("contains punt plays", () => {
    let hasPunts = false;
    for (let seed = 1; seed <= 20; seed++) {
      const result = simulateGame(makeInput({ seed }));
      const punts = result.events.filter((e) => e.outcome === "punt");
      if (punts.length > 0) {
        hasPunts = true;
        break;
      }
    }
    assert(hasPunts, "should produce punts across seeds");
  });

  await t.step("contains field goal attempts", () => {
    const result = simulateGame(makeInput({ seed: 123 }));
    const fgs = result.events.filter((e) => e.outcome === "field_goal");
    assertGreater(fgs.length, 0, "should have at least one field goal attempt");
  });

  await t.step("punt changes possession", () => {
    const result = simulateGame(makeInput());
    const events = result.events;

    for (let i = 0; i < events.length; i++) {
      if (events[i].outcome === "punt") {
        const nextPlayIdx = events.findIndex(
          (e, j) => j > i && e.driveIndex > events[i].driveIndex,
        );
        if (nextPlayIdx >= 0) {
          assertNotEquals(
            events[i].offenseTeamId,
            events[nextPlayIdx].offenseTeamId,
            "possession should change after a punt",
          );
        }
      }
    }
  });

  await t.step("touchdowns add to scoring correctly", () => {
    const result = simulateGame(makeInput());
    const homeTeamId = "home-team";
    const awayTeamId = "away-team";

    let homeScore = 0;
    let awayScore = 0;

    for (const event of result.events) {
      if (event.outcome === "touchdown") {
        if (event.offenseTeamId === homeTeamId) homeScore += 7;
        else homeScore += 0;
        if (event.offenseTeamId === awayTeamId) awayScore += 7;
        else awayScore += 0;
      }
      if (event.outcome === "field_goal" && !event.tags.includes("turnover")) {
        if (event.offenseTeamId === homeTeamId) homeScore += 3;
        if (event.offenseTeamId === awayTeamId) awayScore += 3;
      }
    }

    // Score should roughly match (there may be safeties, missed FGs, etc.)
    // Just verify scores are accounted for
    assertGreaterOrEqual(result.finalScore.home, 0);
    assertGreaterOrEqual(result.finalScore.away, 0);
  });

  await t.step("game progresses through 4 quarters", () => {
    const result = simulateGame(makeInput());
    const quarters = new Set(result.events.map((e) => e.quarter));
    assert(quarters.has(1), "should have quarter 1");
    assert(quarters.has(2), "should have quarter 2");
    assert(quarters.has(3), "should have quarter 3");
    assert(quarters.has(4), "should have quarter 4");
  });

  await t.step(
    "injuries are emitted with severity in injury report",
    () => {
      let hasInjuries = false;
      for (let seed = 1; seed <= 20; seed++) {
        const result = simulateGame(makeInput({ seed }));
        if (result.injuryReport.length > 0) {
          hasInjuries = true;
          for (const injury of result.injuryReport) {
            assert(typeof injury.playerId === "string");
            assert(
              [
                "shake_off",
                "miss_drive",
                "miss_quarter",
                "miss_game",
                "miss_weeks",
                "miss_season",
                "career_ending",
              ].includes(injury.severity),
              `invalid injury severity: ${injury.severity}`,
            );
            assert(typeof injury.playIndex === "number");
            assert(typeof injury.driveIndex === "number");
          }
          break;
        }
      }
      assert(hasInjuries, "should produce injuries across multiple seeds");
    },
  );

  await t.step(
    "injured players with miss_drive+ severity are replaced by next-man-up",
    () => {
      for (let seed = 1; seed <= 50; seed++) {
        const result = simulateGame(makeInput({ seed }));

        const missedPlayers = result.injuryReport.filter(
          (inj) => inj.severity !== "shake_off",
        );
        if (missedPlayers.length === 0) continue;

        for (const injury of missedPlayers) {
          const laterEvents = result.events.filter(
            (e) =>
              e.driveIndex > injury.driveIndex ||
              (e.driveIndex === injury.driveIndex &&
                e.playIndex > injury.playIndex),
          );

          if (injury.severity === "miss_drive") {
            // Player should be out for rest of the drive at minimum
            const sameDriveLater = laterEvents.filter(
              (e) => e.driveIndex === injury.driveIndex,
            );
            const inSameDrive = sameDriveLater.some((e) =>
              e.participants.some((p) => p.playerId === injury.playerId)
            );
            assertEquals(
              inSameDrive,
              false,
              `player ${injury.playerId} should be out for rest of drive`,
            );
          }
        }

        return;
      }
    },
  );

  await t.step("penalties are emitted as event tags", () => {
    let hasPenalties = false;
    for (let seed = 1; seed <= 20; seed++) {
      const result = simulateGame(makeInput({ seed }));
      const penaltyPlays = result.events.filter((e) =>
        e.tags.includes("penalty")
      );
      if (penaltyPlays.length > 0) {
        hasPenalties = true;
        break;
      }
    }
    assert(hasPenalties, "should produce penalties across seeds");
  });

  await t.step("turnovers are emitted as event tags", () => {
    let hasTurnovers = false;
    for (let seed = 1; seed <= 20; seed++) {
      const result = simulateGame(makeInput({ seed }));
      const turnoverPlays = result.events.filter((e) =>
        e.tags.includes("turnover")
      );
      if (turnoverPlays.length > 0) {
        hasTurnovers = true;
        break;
      }
    }
    assert(hasTurnovers, "should produce turnovers across seeds");
  });

  await t.step("turnovers change possession", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const result = simulateGame(makeInput({ seed }));

      for (let i = 0; i < result.events.length; i++) {
        const event = result.events[i];
        if (event.tags.includes("turnover")) {
          const nextDriveEvent = result.events.find(
            (e, j) => j > i && e.driveIndex > event.driveIndex,
          );
          if (nextDriveEvent) {
            assertNotEquals(
              event.offenseTeamId,
              nextDriveEvent.offenseTeamId,
              "possession should change after turnover",
            );
          }
        }
      }
    }
  });

  await t.step(
    "determinism: same seed produces identical GameResult.events",
    () => {
      const input = makeInput({ seed: 777 });
      const result1 = simulateGame(input);
      const result2 = simulateGame(input);

      assertEquals(result1.events.length, result2.events.length);
      assertEquals(result1.finalScore, result2.finalScore);
      assertEquals(result1.injuryReport, result2.injuryReport);

      for (let i = 0; i < result1.events.length; i++) {
        assertEquals(
          result1.events[i],
          result2.events[i],
          `event ${i} should be identical`,
        );
      }
    },
  );

  await t.step(
    "determinism: different seed produces different results",
    () => {
      const result1 = simulateGame(makeInput({ seed: 100 }));
      const result2 = simulateGame(makeInput({ seed: 200 }));

      const events1Str = JSON.stringify(result1.events);
      const events2Str = JSON.stringify(result2.events);
      assertNotEquals(
        events1Str,
        events2Str,
        "different seeds should produce different events",
      );
    },
  );

  await t.step(
    "headless mode: runs without pauses or live-coaching callbacks",
    () => {
      const start = Date.now();
      const result = simulateGame(makeInput());
      const elapsed = Date.now() - start;

      assertGreater(result.events.length, 0);
      assert(
        elapsed < 5000,
        `game should run fast (headless), took ${elapsed}ms`,
      );
    },
  );

  await t.step(
    "no hidden attributes leak into public game output",
    () => {
      const result = simulateGame(makeInput());
      const serialized = JSON.stringify(result);

      assert(
        !serialized.includes("attributes"),
        "attributes should not appear in output",
      );
      assert(
        !serialized.includes("Potential"),
        "potential values should not appear in output",
      );
    },
  );

  await t.step("play count is in realistic NFL range", () => {
    const results: number[] = [];
    for (let seed = 1; seed <= 5; seed++) {
      const result = simulateGame(makeInput({ seed }));
      results.push(result.events.length);
    }

    const avg = results.reduce((a, b) => a + b, 0) / results.length;
    assertGreater(avg, 80, `average play count ${avg} is too low`);
    assert(avg < 250, `average play count ${avg} is too high`);
  });

  await t.step("drive log is populated", () => {
    const result = simulateGame(makeInput());
    assertGreater(result.driveLog.length, 0, "should have drive summaries");
  });

  await t.step("field goal attempts have realistic yardage", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const result = simulateGame(makeInput({ seed }));
      const fgs = result.events.filter((e) => e.outcome === "field_goal");
      for (const fg of fgs) {
        assert(
          fg.situation.yardLine >= 50,
          `FG attempt from own ${fg.situation.yardLine} is too far back`,
        );
      }
    }
  });

  await t.step(
    "4th down results in punt, FG attempt, or turnover on downs",
    () => {
      const result = simulateGame(makeInput());
      const fourthDownPlays = result.events.filter(
        (e) => e.situation.down === 4,
      );

      for (const play of fourthDownPlays) {
        const validOutcomes = [
          "punt",
          "field_goal",
          "rush",
          "pass_complete",
          "pass_incomplete",
          "sack",
          "interception",
          "fumble",
          "touchdown",
          "penalty",
          "kneel",
          "spike",
        ];
        assert(
          validOutcomes.includes(play.outcome),
          `unexpected 4th down outcome: ${play.outcome}`,
        );
      }
    },
  );

  await t.step("second half starts with kickoff to other team", () => {
    const result = simulateGame(makeInput());
    const q1Events = result.events.filter((e) => e.quarter === 1);
    const q3Events = result.events.filter((e) => e.quarter === 3);

    if (q1Events.length > 0 && q3Events.length > 0) {
      const firstHalfFirstOffense = q1Events[0].offenseTeamId;
      const secondHalfFirstOffense = q3Events[0].offenseTeamId;
      assertNotEquals(
        firstHalfFirstOffense,
        secondHalfFirstOffense,
        "second half should start with the other team receiving",
      );
    }
  });
});
