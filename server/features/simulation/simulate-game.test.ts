import { assertEquals, assertExists, assertGreater } from "@std/assert";
import {
  PLAYER_ATTRIBUTE_KEYS,
  type PlayerAttributes,
  type SchemeFingerprint,
} from "@zone-blitz/shared";
import type { PlayerRuntime } from "./resolve-play.ts";
import type { CoachingMods } from "./resolve-play.ts";
import type { InjurySeverity, PlayEvent } from "./events.ts";
import { type SimTeam, simulateGame } from "./simulate-game.ts";

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

function makeCoachingMods(): CoachingMods {
  return { schemeFitBonus: 2, situationalBonus: 1 };
}

function makeStarters(prefix: string): PlayerRuntime[] {
  return [
    makePlayer(`${prefix}-qb`, "QB"),
    makePlayer(`${prefix}-rb`, "RB"),
    makePlayer(`${prefix}-wr1`, "WR"),
    makePlayer(`${prefix}-wr2`, "WR"),
    makePlayer(`${prefix}-te`, "TE"),
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
    makePlayer(`${prefix}-cb1`, "CB"),
    makePlayer(`${prefix}-cb2`, "CB"),
    makePlayer(`${prefix}-s1`, "S"),
    makePlayer(`${prefix}-s2`, "S"),
    makePlayer(`${prefix}-k`, "K"),
    makePlayer(`${prefix}-p`, "K"),
  ];
}

function makeBench(prefix: string): PlayerRuntime[] {
  return [
    makePlayer(`${prefix}-qb2`, "QB"),
    makePlayer(`${prefix}-rb2`, "RB"),
    makePlayer(`${prefix}-wr3`, "WR"),
    makePlayer(`${prefix}-wr4`, "WR"),
    makePlayer(`${prefix}-te2`, "TE"),
    makePlayer(`${prefix}-ot3`, "OT"),
    makePlayer(`${prefix}-iol4`, "IOL"),
    makePlayer(`${prefix}-edge3`, "EDGE"),
    makePlayer(`${prefix}-idl3`, "IDL"),
    makePlayer(`${prefix}-lb3`, "LB"),
    makePlayer(`${prefix}-cb3`, "CB"),
    makePlayer(`${prefix}-s3`, "S"),
  ];
}

function makeTeam(prefix: string): SimTeam {
  return {
    teamId: `team-${prefix}`,
    starters: makeStarters(prefix),
    bench: makeBench(prefix),
    fingerprint: makeFingerprint(),
    coachingMods: makeCoachingMods(),
  };
}

Deno.test("simulateGame", async (t) => {
  await t.step("returns a GameResult with all required fields", () => {
    const result = simulateGame({
      home: makeTeam("home"),
      away: makeTeam("away"),
      seed: 42,
    });

    assertExists(result.gameId);
    assertEquals(result.seed, 42);
    assertExists(result.finalScore);
    assertEquals(typeof result.finalScore.home, "number");
    assertEquals(typeof result.finalScore.away, "number");
    assertGreater(result.events.length, 0);
    assertExists(result.boxScore);
    assertExists(result.boxScore.home);
    assertExists(result.boxScore.away);
    assertGreater(result.driveLog.length, 0);
    assertExists(result.injuryReport);
  });

  await t.step("determinism: same seed produces byte-identical events", () => {
    const home = makeTeam("home");
    const away = makeTeam("away");

    const result1 = simulateGame({ home, away, seed: 12345 });
    const result2 = simulateGame({ home, away, seed: 12345 });

    assertEquals(result1.events.length, result2.events.length);
    assertEquals(result1.finalScore, result2.finalScore);
    assertEquals(result1.driveLog, result2.driveLog);
    assertEquals(result1.injuryReport, result2.injuryReport);

    for (let i = 0; i < result1.events.length; i++) {
      assertEquals(result1.events[i], result2.events[i]);
    }
  });

  await t.step("different seeds produce different results", () => {
    const home = makeTeam("home");
    const away = makeTeam("away");

    const result1 = simulateGame({ home, away, seed: 1 });
    const result2 = simulateGame({ home, away, seed: 9999 });

    const score1 = `${result1.finalScore.home}-${result1.finalScore.away}`;
    const score2 = `${result2.finalScore.home}-${result2.finalScore.away}`;
    const events1 = result1.events.length;
    const events2 = result2.events.length;

    const different = score1 !== score2 || events1 !== events2;
    assertEquals(different, true);
  });

  await t.step("game has events across multiple quarters", () => {
    const result = simulateGame({
      home: makeTeam("home"),
      away: makeTeam("away"),
      seed: 42,
    });

    const quarters = new Set(result.events.map((e) => e.quarter));
    assertGreater(quarters.size, 1);
  });

  await t.step(
    "scores are non-negative and come from valid scoring plays",
    () => {
      const result = simulateGame({
        home: makeTeam("home"),
        away: makeTeam("away"),
        seed: 42,
      });

      assertEquals(result.finalScore.home >= 0, true);
      assertEquals(result.finalScore.away >= 0, true);

      const scoringEvents = result.events.filter(
        (e) =>
          e.outcome === "touchdown" ||
          e.outcome === "field_goal" ||
          e.tags.includes("safety"),
      );
      assertGreater(scoringEvents.length, 0);
    },
  );

  await t.step("drive log tracks all drives with valid results", () => {
    const result = simulateGame({
      home: makeTeam("home"),
      away: makeTeam("away"),
      seed: 42,
    });

    for (const drive of result.driveLog) {
      assertExists(drive.offenseTeamId);
      assertGreater(drive.plays, 0);
      assertEquals(typeof drive.yards, "number");
      assertEquals(typeof drive.startYardLine, "number");
      assertExists(drive.result);
    }
  });

  await t.step("punt plays emit punt outcome", () => {
    let foundPunt = false;
    for (let seed = 1; seed <= 20 && !foundPunt; seed++) {
      const result = simulateGame({
        home: makeTeam("home"),
        away: makeTeam("away"),
        seed,
      });
      const puntEvents = result.events.filter((e) => e.outcome === "punt");
      if (puntEvents.length > 0) {
        foundPunt = true;
        for (const punt of puntEvents) {
          assertEquals(punt.outcome, "punt");
          assertGreater(punt.yardage, 0);
        }
      }
    }
    assertEquals(foundPunt, true);
  });

  await t.step("field goal plays emit field_goal outcome", () => {
    let foundFG = false;
    for (let seed = 1; seed <= 20 && !foundFG; seed++) {
      const result = simulateGame({
        home: makeTeam("home"),
        away: makeTeam("away"),
        seed,
      });
      const fgEvents = result.events.filter((e) => e.outcome === "field_goal");
      if (fgEvents.length > 0) {
        foundFG = true;
        for (const fg of fgEvents) {
          assertEquals(fg.outcome, "field_goal");
        }
      }
    }
    assertEquals(foundFG, true);
  });

  await t.step("injuries emitted as PlayTag with severity tier", () => {
    const allSeverities: InjurySeverity[] = [
      "shake_off",
      "miss_drive",
      "miss_quarter",
      "miss_game",
      "miss_weeks",
      "miss_season",
      "career_ending",
    ];

    let foundInjury = false;
    for (let seed = 1; seed <= 50 && !foundInjury; seed++) {
      const result = simulateGame({
        home: makeTeam("home"),
        away: makeTeam("away"),
        seed,
      });

      const injuryEvents = result.events.filter((e) =>
        e.tags.includes("injury")
      );
      if (injuryEvents.length > 0) {
        foundInjury = true;
        for (const event of injuryEvents) {
          const severityTag = event.tags.find((t) => t.startsWith("injury_"));
          assertExists(severityTag);
          const severity = severityTag!.replace("injury_", "");
          assertEquals(
            allSeverities.includes(severity as InjurySeverity),
            true,
          );
        }
      }
    }
    assertEquals(foundInjury, true);
  });

  await t.step(
    "injury report entries match injury events in play stream",
    () => {
      let foundInjury = false;
      for (let seed = 1; seed <= 50 && !foundInjury; seed++) {
        const result = simulateGame({
          home: makeTeam("home"),
          away: makeTeam("away"),
          seed,
        });

        if (result.injuryReport.length > 0) {
          foundInjury = true;
          for (const entry of result.injuryReport) {
            assertExists(entry.playerId);
            assertEquals(typeof entry.playIndex, "number");
            assertEquals(typeof entry.driveIndex, "number");
            assertExists(entry.severity);
          }
        }
      }
      assertEquals(foundInjury, true);
    },
  );

  await t.step(
    "next-man-up: injured player does not appear in subsequent plays",
    () => {
      for (let seed = 1; seed <= 100; seed++) {
        const result = simulateGame({
          home: makeTeam("home"),
          away: makeTeam("away"),
          seed,
        });

        for (const injury of result.injuryReport) {
          if (injury.severity === "shake_off") continue;

          const injuredEventIdx = result.events.findIndex(
            (e) =>
              e.driveIndex === injury.driveIndex &&
              e.playIndex === injury.playIndex,
          );
          if (injuredEventIdx < 0) continue;

          const laterEvents = result.events.slice(injuredEventIdx + 1);
          for (const event of laterEvents) {
            const playerInPlay = event.participants.some(
              (p) => p.playerId === injury.playerId,
            );
            assertEquals(
              playerInPlay,
              false,
              `Injured player ${injury.playerId} (${injury.severity}) appeared after injury on play ${injury.playIndex}`,
            );
          }
        }
      }
    },
  );

  await t.step("penalties emitted as event tags", () => {
    let foundPenalty = false;
    for (let seed = 1; seed <= 20 && !foundPenalty; seed++) {
      const result = simulateGame({
        home: makeTeam("home"),
        away: makeTeam("away"),
        seed,
      });
      const penaltyEvents = result.events.filter((e) =>
        e.tags.includes("penalty")
      );
      if (penaltyEvents.length > 0) {
        foundPenalty = true;
      }
    }
    assertEquals(foundPenalty, true);
  });

  await t.step("turnovers emitted as event tags", () => {
    let foundTurnover = false;
    for (let seed = 1; seed <= 20 && !foundTurnover; seed++) {
      const result = simulateGame({
        home: makeTeam("home"),
        away: makeTeam("away"),
        seed,
      });
      const turnoverEvents = result.events.filter((e) =>
        e.tags.includes("turnover")
      );
      if (turnoverEvents.length > 0) {
        foundTurnover = true;
      }
    }
    assertEquals(foundTurnover, true);
  });

  await t.step(
    "headless mode: runs without UI hooks or pauses",
    () => {
      const start = performance.now();
      const result = simulateGame({
        home: makeTeam("home"),
        away: makeTeam("away"),
        seed: 42,
      });
      const elapsed = performance.now() - start;

      assertExists(result);
      assertEquals(elapsed < 5000, true);
    },
  );

  await t.step(
    "no hidden attributes leak into public game output",
    () => {
      const result = simulateGame({
        home: makeTeam("home"),
        away: makeTeam("away"),
        seed: 42,
      });

      const json = JSON.stringify(result);
      for (const key of PLAYER_ATTRIBUTE_KEYS) {
        assertEquals(
          json.includes(`"${key}"`),
          false,
          `Hidden attribute "${key}" found in game output`,
        );
      }
    },
  );

  await t.step("box score tallies match event stream", () => {
    const result = simulateGame({
      home: makeTeam("home"),
      away: makeTeam("away"),
      seed: 42,
    });

    let homePassing = 0;
    let homeRushing = 0;
    let awayPassing = 0;
    let awayRushing = 0;

    for (const event of result.events) {
      const isHome = event.offenseTeamId === "team-home";
      if (
        event.outcome === "pass_complete"
      ) {
        if (isHome) homePassing += event.yardage;
        else awayPassing += event.yardage;
      } else if (event.outcome === "rush") {
        if (isHome) homeRushing += event.yardage;
        else awayRushing += event.yardage;
      } else if (event.outcome === "sack") {
        if (isHome) homePassing += event.yardage;
        else awayPassing += event.yardage;
      }
    }

    assertEquals(result.boxScore.home.passingYards, homePassing);
    assertEquals(result.boxScore.home.rushingYards, homeRushing);
    assertEquals(result.boxScore.away.passingYards, awayPassing);
    assertEquals(result.boxScore.away.rushingYards, awayRushing);
  });

  await t.step("possession alternates after scoring drives", () => {
    const result = simulateGame({
      home: makeTeam("home"),
      away: makeTeam("away"),
      seed: 42,
    });

    for (let i = 0; i < result.driveLog.length - 1; i++) {
      const current = result.driveLog[i];
      const next = result.driveLog[i + 1];
      if (
        current.result === "touchdown" || current.result === "field_goal"
      ) {
        assertEquals(
          current.offenseTeamId !== next.offenseTeamId,
          true,
          `Possession should switch after ${current.result} on drive ${i}`,
        );
      }
    }
  });

  await t.step("events reference correct team IDs", () => {
    const result = simulateGame({
      home: makeTeam("home"),
      away: makeTeam("away"),
      seed: 42,
    });

    for (const event of result.events) {
      const validOffense = event.offenseTeamId === "team-home" ||
        event.offenseTeamId === "team-away";
      const validDefense = event.defenseTeamId === "team-home" ||
        event.defenseTeamId === "team-away";
      assertEquals(validOffense, true);
      assertEquals(validDefense, true);
      assertEquals(
        event.offenseTeamId !== event.defenseTeamId,
        true,
      );
    }
  });

  await t.step("uses provided gameId when given", () => {
    const result = simulateGame({
      home: makeTeam("home"),
      away: makeTeam("away"),
      seed: 42,
      gameId: "custom-game-id",
    });

    assertEquals(result.gameId, "custom-game-id");
    for (const event of result.events) {
      assertEquals(event.gameId, "custom-game-id");
    }
  });

  await t.step(
    "events have monotonically increasing play indices within drives",
    () => {
      const result = simulateGame({
        home: makeTeam("home"),
        away: makeTeam("away"),
        seed: 42,
      });

      const byDrive = new Map<number, PlayEvent[]>();
      for (const event of result.events) {
        if (event.outcome === "kickoff") continue;
        const list = byDrive.get(event.driveIndex) ?? [];
        list.push(event);
        byDrive.set(event.driveIndex, list);
      }

      for (const [, plays] of byDrive) {
        for (let i = 1; i < plays.length; i++) {
          assertEquals(
            plays[i].playIndex > plays[i - 1].playIndex,
            true,
          );
        }
      }
    },
  );

  await t.step("kickoff events emitted at start of game", () => {
    const result = simulateGame({
      home: makeTeam("home"),
      away: makeTeam("away"),
      seed: 42,
    });

    const firstEvent = result.events[0];
    assertEquals(firstEvent.outcome, "kickoff");
    assertEquals(firstEvent.call.concept, "kickoff");
    assertEquals(firstEvent.call.personnel, "special_teams");
  });

  await t.step("kickoff events emitted after every score", () => {
    const result = simulateGame({
      home: makeTeam("home"),
      away: makeTeam("away"),
      seed: 42,
    });

    for (let i = 0; i < result.events.length - 1; i++) {
      const event = result.events[i];
      if (
        event.outcome === "touchdown" ||
        event.outcome === "field_goal"
      ) {
        const nextEvent = result.events[i + 1];
        assertEquals(
          nextEvent.outcome,
          "kickoff",
          `Expected kickoff after ${event.outcome} at event index ${i}`,
        );
      }
    }
  });

  await t.step("multiple kickoff events exist across a full game", () => {
    const result = simulateGame({
      home: makeTeam("home"),
      away: makeTeam("away"),
      seed: 42,
    });

    const kickoffs = result.events.filter((e) => e.outcome === "kickoff");
    assertGreater(kickoffs.length, 1);
  });

  await t.step("kickoff event has kicker participant", () => {
    const result = simulateGame({
      home: makeTeam("home"),
      away: makeTeam("away"),
      seed: 42,
    });

    const kickoffs = result.events.filter((e) => e.outcome === "kickoff");
    for (const ko of kickoffs) {
      const kicker = ko.participants.find((p) => p.role === "kicker");
      assertEquals(kicker !== undefined, true);
    }
  });

  await t.step("kickoff yardage does not pollute box score", () => {
    const result = simulateGame({
      home: makeTeam("home"),
      away: makeTeam("away"),
      seed: 42,
    });

    let homePassing = 0;
    let homeRushing = 0;
    let awayPassing = 0;
    let awayRushing = 0;

    for (const event of result.events) {
      if (event.outcome === "kickoff") continue;

      const isHome = event.offenseTeamId === "team-home";
      if (event.outcome === "pass_complete") {
        if (isHome) homePassing += event.yardage;
        else awayPassing += event.yardage;
      } else if (event.outcome === "rush") {
        if (isHome) homeRushing += event.yardage;
        else awayRushing += event.yardage;
      } else if (event.outcome === "sack") {
        if (isHome) homePassing += event.yardage;
        else awayPassing += event.yardage;
      }
    }

    assertEquals(result.boxScore.home.passingYards, homePassing);
    assertEquals(result.boxScore.home.rushingYards, homeRushing);
    assertEquals(result.boxScore.away.passingYards, awayPassing);
    assertEquals(result.boxScore.away.rushingYards, awayRushing);
  });

  await t.step(
    "onside kicks can occur when trailing in Q4 final minutes",
    () => {
      let foundOnside = false;
      for (let seed = 1; seed <= 5000 && !foundOnside; seed++) {
        const result = simulateGame({
          home: makeTeam("home"),
          away: makeTeam("away"),
          seed,
        });

        const onsideEvents = result.events.filter((e) =>
          e.tags.includes("onside" as PlayEvent["tags"][number])
        );
        if (onsideEvents.length > 0) {
          foundOnside = true;
          for (const e of onsideEvents) {
            assertEquals(e.outcome, "kickoff");
          }
        }
      }
      assertEquals(foundOnside, true);
    },
  );
});
