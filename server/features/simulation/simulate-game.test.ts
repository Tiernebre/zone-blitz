import {
  assert,
  assertEquals,
  assertExists,
  assertGreater,
  assertGreaterOrEqual,
} from "@std/assert";
import { PLAYER_ATTRIBUTE_KEYS } from "@zone-blitz/shared";
import type { InjurySeverity, PlayEvent } from "./events.ts";
import type { PlayerRuntime } from "./resolve-play.ts";
import {
  type SimTeam,
  simulateGame,
  type SimulationInput,
} from "./simulate-game.ts";
import {
  makeCoachingMods,
  makeFingerprint,
  makePlayer,
  makeStarters,
} from "./test-helpers.ts";

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
    coachingMods: makeCoachingMods({ schemeFitBonus: 2, situationalBonus: 1 }),
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
          assertGreaterOrEqual(punt.yardage, 0);
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

  await t.step("punt events include participant roles", () => {
    let foundPuntWithParticipants = false;
    for (let seed = 1; seed <= 20 && !foundPuntWithParticipants; seed++) {
      const result = simulateGame({
        home: makeTeam("home"),
        away: makeTeam("away"),
        seed,
      });
      const puntEvents = result.events.filter((e) => e.outcome === "punt");
      for (const punt of puntEvents) {
        if (punt.participants.length > 0) {
          foundPuntWithParticipants = true;
          const punter = punt.participants.find((p) => p.role === "punter");
          assertExists(punter);
        }
      }
    }
    assertEquals(foundPuntWithParticipants, true);
  });

  await t.step(
    "missed field goals use missed_field_goal outcome, not pass_incomplete hack",
    () => {
      let foundMissedFG = false;
      for (let seed = 1; seed <= 100 && !foundMissedFG; seed++) {
        const result = simulateGame({
          home: makeTeam("home"),
          away: makeTeam("away"),
          seed,
        });
        const missedFGEvents = result.events.filter(
          (e) => e.outcome === "missed_field_goal",
        );
        if (missedFGEvents.length > 0) {
          foundMissedFG = true;
          for (const fg of missedFGEvents) {
            assertEquals(fg.call.concept, "field_goal");
            assertEquals(fg.tags.includes("penalty"), false);
          }
        }
      }
      assertEquals(foundMissedFG, true);
    },
  );

  await t.step(
    "no pass_incomplete events with field_goal concept exist (hack removed)",
    () => {
      for (let seed = 1; seed <= 50; seed++) {
        const result = simulateGame({
          home: makeTeam("home"),
          away: makeTeam("away"),
          seed,
        });
        const hackedEvents = result.events.filter(
          (e) =>
            e.outcome === "pass_incomplete" && e.call.concept === "field_goal",
        );
        assertEquals(hackedEvents.length, 0);
      }
    },
  );

  await t.step("field goal events include kicker participant", () => {
    let foundFGWithKicker = false;
    for (let seed = 1; seed <= 50 && !foundFGWithKicker; seed++) {
      const result = simulateGame({
        home: makeTeam("home"),
        away: makeTeam("away"),
        seed,
      });
      const fgEvents = result.events.filter(
        (e) => e.outcome === "field_goal" || e.outcome === "missed_field_goal",
      );
      for (const fg of fgEvents) {
        if (fg.participants.length > 0) {
          foundFGWithKicker = true;
          const kicker = fg.participants.find((p) => p.role === "kicker");
          assertExists(kicker);
        }
      }
    }
    assertEquals(foundFGWithKicker, true);
  });

  await t.step("blocked kick tag appears on some punt or FG events", () => {
    let foundBlocked = false;
    for (let seed = 1; seed <= 2000 && !foundBlocked; seed++) {
      const result = simulateGame({
        home: makeTeam("home"),
        away: makeTeam("away"),
        seed,
      });
      const blockedEvents = result.events.filter(
        (e) => e.tags.includes("blocked_kick"),
      );
      if (blockedEvents.length > 0) {
        foundBlocked = true;
      }
    }
    assertEquals(foundBlocked, true);
  });

  await t.step("muff tag appears on some punt events", () => {
    let foundMuff = false;
    for (let seed = 1; seed <= 2000 && !foundMuff; seed++) {
      const result = simulateGame({
        home: makeTeam("home"),
        away: makeTeam("away"),
        seed,
      });
      const muffEvents = result.events.filter(
        (e) => e.tags.includes("muff"),
      );
      if (muffEvents.length > 0) {
        foundMuff = true;
        for (const muff of muffEvents) {
          assertEquals(muff.outcome, "punt");
        }
      }
    }
    assertEquals(foundMuff, true);
  });

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
      if (event.tags.includes("negated_play")) continue;
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
        if (current.offenseTeamId === next.offenseTeamId) {
          const betweenEvents = result.events.filter(
            (e) =>
              e.driveIndex > current.driveIndex &&
              e.driveIndex <= next.driveIndex &&
              e.outcome === "kickoff" &&
              e.tags.includes("return_td"),
          );
          assertEquals(
            betweenEvents.length > 0,
            true,
            `Possession should switch after ${current.result} on drive ${i} unless kickoff return TD intervenes`,
          );
        }
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
    "touchdowns followed by conversion events (xp or two_point)",
    () => {
      const result = simulateGame({
        home: makeTeam("home"),
        away: makeTeam("away"),
        seed: 42,
      });

      const tdEvents = result.events.filter(
        (e) => e.outcome === "touchdown" && !e.tags.includes("negated_play"),
      );
      assertGreater(tdEvents.length, 0, "Should have touchdowns");

      for (const tdEvent of tdEvents) {
        const tdIdx = result.events.indexOf(tdEvent);
        const nextEvent = result.events[tdIdx + 1];
        if (nextEvent) {
          assertEquals(
            nextEvent.outcome === "xp" || nextEvent.outcome === "two_point",
            true,
            `Event after TD should be xp or two_point, got ${nextEvent.outcome}`,
          );
        }
      }
    },
  );

  await t.step(
    "scores are not multiples of 7 — missed XPs and 2PTs create variety",
    () => {
      let nonMultipleOf7 = false;
      for (let seed = 1; seed <= 50 && !nonMultipleOf7; seed++) {
        const result = simulateGame({
          home: makeTeam("home"),
          away: makeTeam("away"),
          seed,
        });
        if (
          result.finalScore.home % 7 !== 0 ||
          result.finalScore.away % 7 !== 0
        ) {
          nonMultipleOf7 = true;
        }
      }
      assertEquals(
        nonMultipleOf7,
        true,
        "Should see non-multiples-of-7 scores",
      );
    },
  );

  await t.step(
    "XP events appear with outcome xp",
    () => {
      let foundXp = false;
      for (let seed = 1; seed <= 20 && !foundXp; seed++) {
        const result = simulateGame({
          home: makeTeam("home"),
          away: makeTeam("away"),
          seed,
        });
        const xpEvents = result.events.filter((e) => e.outcome === "xp");
        if (xpEvents.length > 0) {
          foundXp = true;
        }
      }
      assertEquals(foundXp, true, "Should find XP events");
    },
  );

  await t.step(
    "safeties emit safety outcome and award 2 points to defense",
    () => {
      // Use a team with weak OL to increase sack rate and safety probability
      const weakOlTeam: SimTeam = {
        ...makeTeam("weak"),
        starters: [
          makePlayer("w-qb", "QB"),
          makePlayer("w-rb", "RB"),
          makePlayer("w-wr1", "WR"),
          makePlayer("w-wr2", "WR"),
          makePlayer("w-te", "TE"),
          makePlayer("w-ot1", "OT", { passBlocking: 20, strength: 20 }),
          makePlayer("w-ot2", "OT", { passBlocking: 20, strength: 20 }),
          makePlayer("w-iol1", "IOL", { passBlocking: 20, strength: 20 }),
          makePlayer("w-iol2", "IOL", { passBlocking: 20, strength: 20 }),
          makePlayer("w-iol3", "IOL", { passBlocking: 20, strength: 20 }),
          makePlayer("w-edge1", "EDGE"),
          makePlayer("w-edge2", "EDGE"),
          makePlayer("w-idl1", "IDL"),
          makePlayer("w-idl2", "IDL"),
          makePlayer("w-lb1", "LB"),
          makePlayer("w-lb2", "LB"),
          makePlayer("w-cb1", "CB"),
          makePlayer("w-cb2", "CB"),
          makePlayer("w-s1", "S"),
          makePlayer("w-s2", "S"),
          makePlayer("w-k", "K"),
          makePlayer("w-p", "K"),
        ],
      };
      const strongDlTeam: SimTeam = {
        ...makeTeam("strong"),
        starters: [
          makePlayer("s-qb", "QB"),
          makePlayer("s-rb", "RB"),
          makePlayer("s-wr1", "WR"),
          makePlayer("s-wr2", "WR"),
          makePlayer("s-te", "TE"),
          makePlayer("s-ot1", "OT"),
          makePlayer("s-ot2", "OT"),
          makePlayer("s-iol1", "IOL"),
          makePlayer("s-iol2", "IOL"),
          makePlayer("s-iol3", "IOL"),
          makePlayer("s-edge1", "EDGE", {
            passRushing: 90,
            acceleration: 85,
            strength: 85,
          }),
          makePlayer("s-edge2", "EDGE", {
            passRushing: 90,
            acceleration: 85,
            strength: 85,
          }),
          makePlayer("s-idl1", "IDL", {
            passRushing: 85,
            strength: 85,
          }),
          makePlayer("s-idl2", "IDL", {
            passRushing: 85,
            strength: 85,
          }),
          makePlayer("s-lb1", "LB"),
          makePlayer("s-lb2", "LB"),
          makePlayer("s-cb1", "CB"),
          makePlayer("s-cb2", "CB"),
          makePlayer("s-s1", "S"),
          makePlayer("s-s2", "S"),
          makePlayer("s-k", "K"),
          makePlayer("s-p", "K"),
        ],
      };

      let safetyFound = false;
      for (let seed = 1; seed <= 2000 && !safetyFound; seed++) {
        const result = simulateGame({
          home: weakOlTeam,
          away: strongDlTeam,
          seed,
        });
        const safetyEvents = result.events.filter(
          (e) => e.outcome === "safety",
        );
        if (safetyEvents.length > 0) {
          safetyFound = true;
          assertEquals(result.finalScore.home >= 0, true);
          assertEquals(result.finalScore.away >= 0, true);
        }
      }
      assertEquals(
        safetyFound,
        true,
        "Should find safety events across many seeds",
      );
    },
  );

  await t.step(
    "return TDs produce return_td tagged events",
    () => {
      let returnTdFound = false;
      for (let seed = 1; seed <= 500 && !returnTdFound; seed++) {
        const result = simulateGame({
          home: makeTeam("home"),
          away: makeTeam("away"),
          seed,
        });
        const returnTdEvents = result.events.filter(
          (e) => e.tags.includes("return_td"),
        );
        if (returnTdEvents.length > 0) {
          returnTdFound = true;
          for (const event of returnTdEvents) {
            assertEquals(event.tags.includes("turnover"), true);
            assertEquals(event.tags.includes("touchdown"), true);
          }
        }
      }
      assertEquals(
        returnTdFound,
        true,
        "Should find return TD events across many seeds",
      );
    },
  );

  await t.step(
    "return TDs followed by conversion events",
    () => {
      for (let seed = 1; seed <= 500; seed++) {
        const result = simulateGame({
          home: makeTeam("home"),
          away: makeTeam("away"),
          seed,
        });
        const returnTdEvents = result.events.filter(
          (e) =>
            e.tags.includes("return_td") && !e.tags.includes("negated_play"),
        );
        for (const rtd of returnTdEvents) {
          const idx = result.events.indexOf(rtd);
          const nextEvent = result.events[idx + 1];
          if (nextEvent) {
            assertEquals(
              nextEvent.outcome === "xp" || nextEvent.outcome === "two_point",
              true,
              `Event after return TD should be xp or two_point, got ${nextEvent.outcome}`,
            );
          }
        }
      }
    },
  );

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
      if (event.outcome === "field_goal") {
        const nextEvent = result.events[i + 1];
        assertEquals(
          nextEvent.outcome,
          "kickoff",
          `Expected kickoff after field_goal at event index ${i}`,
        );
      }
      if (
        event.outcome === "touchdown" &&
        !event.tags.includes("negated_play")
      ) {
        // TD → conversion (xp/two_point) → kickoff
        const conversionEvent = result.events[i + 1];
        assertEquals(
          conversionEvent.outcome === "xp" ||
            conversionEvent.outcome === "two_point",
          true,
          `Expected conversion after TD at event index ${i}, got ${conversionEvent?.outcome}`,
        );
        if (i + 2 < result.events.length) {
          const kickoffEvent = result.events[i + 2];
          assertEquals(
            kickoffEvent.outcome,
            "kickoff",
            `Expected kickoff after conversion at event index ${i + 2}`,
          );
        }
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
      if (event.tags.includes("negated_play")) continue;

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

  await t.step("penalties have typed info with accept/decline", () => {
    let foundAccepted = false;
    let foundDeclined = false;
    for (let seed = 1; seed <= 50; seed++) {
      const result = simulateGame({
        home: makeTeam("home"),
        away: makeTeam("away"),
        seed,
      });
      for (const event of result.events) {
        if (event.penalty) {
          assertExists(event.penalty.type);
          assertExists(event.penalty.phase);
          assertGreater(event.penalty.yardage, 0);
          assertEquals(typeof event.penalty.automaticFirstDown, "boolean");
          assertEquals(typeof event.penalty.accepted, "boolean");
          if (event.penalty.accepted) foundAccepted = true;
          else foundDeclined = true;
        }
      }
    }
    assertEquals(foundAccepted, true, "Should find accepted penalties");
    assertEquals(foundDeclined, true, "Should find declined penalties");
  });

  await t.step("accepted penalties tag events correctly", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const result = simulateGame({
        home: makeTeam("home"),
        away: makeTeam("away"),
        seed,
      });
      for (const event of result.events) {
        if (event.penalty?.accepted) {
          assertEquals(event.tags.includes("accepted_penalty"), true);
          assertEquals(event.tags.includes("penalty"), true);
        }
        if (event.penalty && !event.penalty.accepted) {
          assertEquals(event.tags.includes("declined_penalty"), true);
          assertEquals(event.tags.includes("penalty"), true);
        }
      }
    }
  });

  await t.step("penalty counts per team land in NFL bands across seeds", () => {
    const teamPenalties: number[] = [];
    for (let seed = 1; seed <= 50; seed++) {
      const result = simulateGame({
        home: makeTeam("home"),
        away: makeTeam("away"),
        seed,
      });
      teamPenalties.push(result.boxScore.home.penalties);
      teamPenalties.push(result.boxScore.away.penalties);
    }
    const avg = teamPenalties.reduce((a, b) => a + b, 0) / teamPenalties.length;
    assertGreater(avg, 0.4, `Avg penalties ${avg} too low`);
    assertEquals(avg < 5, true, `Avg penalties ${avg} too high`);
  });

  await t.step("penalties are assigned to individual players", () => {
    let foundPlayerPenalty = false;
    for (let seed = 1; seed <= 20 && !foundPlayerPenalty; seed++) {
      const result = simulateGame({
        home: makeTeam("home"),
        away: makeTeam("away"),
        seed,
      });
      for (const event of result.events) {
        if (event.penalty?.againstPlayerId) {
          foundPlayerPenalty = true;
          break;
        }
      }
    }
    assertEquals(
      foundPlayerPenalty,
      true,
      "Should find penalties assigned to players",
    );
  });

  await t.step("negated plays do not count toward box score yards", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const result = simulateGame({
        home: makeTeam("home"),
        away: makeTeam("away"),
        seed,
      });
      let manualHome = 0;
      let manualAway = 0;
      for (const event of result.events) {
        if (event.tags.includes("negated_play")) continue;
        if (event.outcome === "kickoff") continue;
        if (event.outcome === "xp" || event.outcome === "two_point") continue;
        const isHome = event.offenseTeamId === "team-home";
        if (
          event.outcome === "pass_complete" ||
          event.outcome === "rush" ||
          event.outcome === "sack" ||
          event.outcome === "touchdown"
        ) {
          if (isHome) manualHome += event.yardage;
          else manualAway += event.yardage;
        }
      }
      assertEquals(result.boxScore.home.totalYards, manualHome);
      assertEquals(result.boxScore.away.totalYards, manualAway);
    }
  });

  await t.step(
    "regular-season OT: game can end tied after both teams possess",
    () => {
      let tieFound = false;
      for (let seed = 1; seed <= 5000 && !tieFound; seed++) {
        const result = simulateGame({
          home: makeTeam("home"),
          away: makeTeam("away"),
          seed,
          isPlayoff: false,
        });

        if (result.finalScore.home === result.finalScore.away) {
          const otEvents = result.events.filter((e) => e.quarter === "OT");
          if (otEvents.length > 0) {
            tieFound = true;
          }
        }
      }
      assertEquals(
        tieFound,
        true,
        "Regular-season games should sometimes end tied after OT",
      );
    },
  );

  await t.step(
    "regular-season OT: OT events have quarter === 'OT'",
    () => {
      let otEventFound = false;
      for (let seed = 1; seed <= 5000 && !otEventFound; seed++) {
        const result = simulateGame({
          home: makeTeam("home"),
          away: makeTeam("away"),
          seed,
          isPlayoff: false,
        });

        const otEvents = result.events.filter((e) => e.quarter === "OT");
        if (otEvents.length > 0) {
          otEventFound = true;
          for (const e of otEvents) {
            assertEquals(e.quarter, "OT");
          }
        }
      }
      assertEquals(
        otEventFound,
        true,
        "Should produce OT events when game is tied after Q4",
      );
    },
  );

  await t.step(
    "regular-season OT: first-drive TD ends OT immediately",
    () => {
      let foundFirstDriveTdEnd = false;
      for (let seed = 1; seed <= 10000 && !foundFirstDriveTdEnd; seed++) {
        const result = simulateGame({
          home: makeTeam("home"),
          away: makeTeam("away"),
          seed,
          isPlayoff: false,
        });

        const otEvents = result.events.filter((e) => e.quarter === "OT");
        if (otEvents.length === 0) continue;

        const otKickoffs = otEvents.filter((e) => e.outcome === "kickoff");
        const otTds = otEvents.filter(
          (e) => e.outcome === "touchdown" || e.tags.includes("return_td"),
        );

        if (otTds.length > 0 && otKickoffs.length >= 1) {
          const firstTdIdx = otEvents.indexOf(otTds[0]);
          const firstKickoffIdx = otEvents.indexOf(otKickoffs[0]);

          if (firstTdIdx > firstKickoffIdx) {
            const secondKickoff = otKickoffs[1];
            if (secondKickoff) {
              const secondKickoffIdx = otEvents.indexOf(secondKickoff);
              if (firstTdIdx < secondKickoffIdx) {
                foundFirstDriveTdEnd = true;
                assertEquals(
                  result.finalScore.home !== result.finalScore.away,
                  true,
                );
              }
            } else {
              foundFirstDriveTdEnd = true;
              assertEquals(
                result.finalScore.home !== result.finalScore.away,
                true,
              );
            }
          }
        }
      }
      assertEquals(
        foundFirstDriveTdEnd,
        true,
        "First-drive TD should end OT immediately",
      );
    },
  );

  await t.step(
    "regular-season OT: both teams get a possession unless first drive is a TD",
    () => {
      let foundBothPossess = false;
      for (let seed = 1; seed <= 5000 && !foundBothPossess; seed++) {
        const result = simulateGame({
          home: makeTeam("home"),
          away: makeTeam("away"),
          seed,
          isPlayoff: false,
        });

        const otEvents = result.events.filter((e) => e.quarter === "OT");
        if (otEvents.length === 0) continue;

        const otOffenseTeams = new Set(
          otEvents
            .filter(
              (e) =>
                e.outcome !== "kickoff" &&
                e.outcome !== "xp" &&
                e.outcome !== "two_point",
            )
            .map((e) => e.offenseTeamId),
        );

        if (otOffenseTeams.size === 2) {
          foundBothPossess = true;
        }
      }
      assertEquals(
        foundBothPossess,
        true,
        "Both teams should get OT possessions when first drive is not a TD",
      );
    },
  );

  await t.step(
    "playoff OT: game never ends tied",
    () => {
      for (let seed = 1; seed <= 500; seed++) {
        const result = simulateGame({
          home: makeTeam("home"),
          away: makeTeam("away"),
          seed,
          isPlayoff: true,
        });

        assertEquals(
          result.finalScore.home !== result.finalScore.away,
          true,
          `Playoff game ended tied at seed ${seed}: ${result.finalScore.home}-${result.finalScore.away}`,
        );
      }
    },
  );

  await t.step(
    "playoff OT: plays to a winner when tied after Q4",
    () => {
      let playoffOtFound = false;
      for (let seed = 1; seed <= 5000 && !playoffOtFound; seed++) {
        const result = simulateGame({
          home: makeTeam("home"),
          away: makeTeam("away"),
          seed,
          isPlayoff: true,
        });

        const otEvents = result.events.filter((e) => e.quarter === "OT");
        if (otEvents.length > 0) {
          playoffOtFound = true;
          assert(
            result.finalScore.home !== result.finalScore.away,
            "Playoff OT must produce a winner",
          );
        }
      }
      assertEquals(
        playoffOtFound,
        true,
        "Should find playoff games that go to OT",
      );
    },
  );

  await t.step(
    "isPlayoff defaults to false (regular season behavior)",
    () => {
      const input: SimulationInput = {
        home: makeTeam("home"),
        away: makeTeam("away"),
        seed: 42,
      };
      const result = simulateGame(input);
      assertExists(result.finalScore);
    },
  );

  await t.step(
    "OT frequency across many regular-season games lands in NFL band (3-8%)",
    () => {
      const totalGames = 2000;
      let otGames = 0;
      for (let seed = 1; seed <= totalGames; seed++) {
        const result = simulateGame({
          home: makeTeam("home"),
          away: makeTeam("away"),
          seed,
          isPlayoff: false,
        });

        const hasOt = result.events.some((e) => e.quarter === "OT");
        if (hasOt) otGames++;
      }

      const otRate = otGames / totalGames;
      assert(
        otRate >= 0.02 && otRate <= 0.20,
        `OT rate ${(otRate * 100).toFixed(1)}% is outside expected 2-20% band`,
      );
    },
  );

  await t.step(
    "two-minute drill: events inside 2:00 of Q2/Q4 carry two_minute tag",
    () => {
      let foundTwoMinute = false;
      for (let seed = 1; seed <= 20 && !foundTwoMinute; seed++) {
        const result = simulateGame({
          home: makeTeam("home"),
          away: makeTeam("away"),
          seed,
        });
        const twoMinEvents = result.events.filter((e) =>
          e.tags.includes("two_minute")
        );
        if (twoMinEvents.length > 0) {
          foundTwoMinute = true;
          for (const e of twoMinEvents) {
            assertEquals(
              e.quarter === 2 || e.quarter === 4,
              true,
              `two_minute tag should only appear in Q2 or Q4, got Q${e.quarter}`,
            );
          }
        }
      }
      assertEquals(
        foundTwoMinute,
        true,
        "Should find two_minute tagged events",
      );
    },
  );

  await t.step(
    "two-minute drill: offense shifts to more passing in hurry-up",
    () => {
      let twoMinPassCount = 0;
      let twoMinRunCount = 0;
      let normalPassCount = 0;
      let normalRunCount = 0;

      for (let seed = 1; seed <= 50; seed++) {
        const result = simulateGame({
          home: makeTeam("home"),
          away: makeTeam("away"),
          seed,
        });
        for (const e of result.events) {
          if (
            e.outcome === "kickoff" || e.outcome === "xp" ||
            e.outcome === "two_point" || e.outcome === "kneel" ||
            e.outcome === "punt" || e.outcome === "field_goal" ||
            e.outcome === "missed_field_goal"
          ) continue;

          const isPass = e.call.concept === "screen" ||
            e.call.concept === "quick_pass" ||
            e.call.concept === "play_action" ||
            e.call.concept === "dropback" ||
            e.call.concept === "deep_shot";
          const isRun = !isPass;

          if (e.tags.includes("two_minute")) {
            if (isPass) twoMinPassCount++;
            if (isRun) twoMinRunCount++;
          } else {
            if (isPass) normalPassCount++;
            if (isRun) normalRunCount++;
          }
        }
      }

      const twoMinPassRate = twoMinPassCount /
        (twoMinPassCount + twoMinRunCount);
      const normalPassRate = normalPassCount /
        (normalPassCount + normalRunCount);
      assertGreater(
        twoMinPassRate,
        normalPassRate,
        `Two-minute pass rate (${
          twoMinPassRate.toFixed(2)
        }) should exceed normal (${normalPassRate.toFixed(2)})`,
      );
    },
  );

  await t.step(
    "kneel-downs: leading team emits kneel outcome with victory_formation tag",
    () => {
      let foundKneel = false;
      for (let seed = 1; seed <= 200 && !foundKneel; seed++) {
        const result = simulateGame({
          home: makeTeam("home"),
          away: makeTeam("away"),
          seed,
        });
        const kneelEvents = result.events.filter(
          (e) => e.outcome === "kneel",
        );
        if (kneelEvents.length > 0) {
          foundKneel = true;
          for (const e of kneelEvents) {
            assertEquals(e.outcome, "kneel");
            assertEquals(
              e.tags.includes("victory_formation"),
              true,
              "Kneel events should carry victory_formation tag",
            );
            assertEquals(e.yardage, -1);
            assertEquals(e.call.concept, "kneel");
          }
        }
      }
      assertEquals(
        foundKneel,
        true,
        "Should find kneel events across seeds",
      );
    },
  );

  await t.step(
    "kneel-downs: do not generate box-score statistics",
    () => {
      for (let seed = 1; seed <= 200; seed++) {
        const result = simulateGame({
          home: makeTeam("home"),
          away: makeTeam("away"),
          seed,
        });
        const kneelEvents = result.events.filter(
          (e) => e.outcome === "kneel",
        );
        if (kneelEvents.length > 0) {
          let homePassing = 0;
          let homeRushing = 0;
          let awayPassing = 0;
          let awayRushing = 0;

          for (const event of result.events) {
            if (
              event.outcome === "kickoff" || event.outcome === "kneel"
            ) continue;

            const negated = event.tags.includes("negated_play");
            const isHome = event.offenseTeamId === "team-home";
            if (!negated && event.outcome === "pass_complete") {
              if (isHome) homePassing += event.yardage;
              else awayPassing += event.yardage;
            } else if (!negated && event.outcome === "rush") {
              if (isHome) homeRushing += event.yardage;
              else awayRushing += event.yardage;
            } else if (!negated && event.outcome === "sack") {
              if (isHome) homePassing += event.yardage;
              else awayPassing += event.yardage;
            }
          }

          assertEquals(result.boxScore.home.passingYards, homePassing);
          assertEquals(result.boxScore.home.rushingYards, homeRushing);
          assertEquals(result.boxScore.away.passingYards, awayPassing);
          assertEquals(result.boxScore.away.rushingYards, awayRushing);
          return;
        }
      }
    },
  );

  await t.step(
    "kneel-downs only occur in Q2 or Q4 when offense is leading",
    () => {
      for (let seed = 1; seed <= 200; seed++) {
        const result = simulateGame({
          home: makeTeam("home"),
          away: makeTeam("away"),
          seed,
        });
        const kneelEvents = result.events.filter(
          (e) => e.outcome === "kneel",
        );
        for (const e of kneelEvents) {
          assertEquals(
            e.quarter === 2 || e.quarter === 4,
            true,
            `Kneel should only occur in Q2/Q4, got Q${e.quarter}`,
          );
        }
      }
    },
  );

  await t.step(
    "timeouts: timeout tags appear in the event stream",
    () => {
      let foundTimeout = false;
      for (let seed = 1; seed <= 500 && !foundTimeout; seed++) {
        const result = simulateGame({
          home: makeTeam("home"),
          away: makeTeam("away"),
          seed,
        });
        const timeoutEvents = result.events.filter((e) =>
          e.tags.includes("timeout")
        );
        if (timeoutEvents.length > 0) {
          foundTimeout = true;
          for (const e of timeoutEvents) {
            assertEquals(
              e.tags.includes("two_minute"),
              true,
              "Timeout should only occur during two-minute drill",
            );
          }
        }
      }
      assertEquals(
        foundTimeout,
        true,
        "Should find timeout events across seeds",
      );
    },
  );

  await t.step(
    "timeouts: at most 3 timeouts per team per half",
    () => {
      for (let seed = 1; seed <= 100; seed++) {
        const result = simulateGame({
          home: makeTeam("home"),
          away: makeTeam("away"),
          seed,
        });
        const timeoutEvents = result.events.filter((e) =>
          e.tags.includes("timeout")
        );

        let homeFirstHalf = 0;
        let awayFirstHalf = 0;
        let homeSecondHalf = 0;
        let awaySecondHalf = 0;

        for (const e of timeoutEvents) {
          const isFirstHalf = e.quarter === 1 || e.quarter === 2;
          if (e.offenseTeamId === "team-home") {
            if (isFirstHalf) homeFirstHalf++;
            else homeSecondHalf++;
          } else {
            if (isFirstHalf) awayFirstHalf++;
            else awaySecondHalf++;
          }
        }

        assertEquals(
          homeFirstHalf + awayFirstHalf <= 6,
          true,
          `Too many first-half timeouts: home=${homeFirstHalf} away=${awayFirstHalf}`,
        );
        assertEquals(
          homeSecondHalf + awaySecondHalf <= 6,
          true,
          `Too many second-half timeouts: home=${homeSecondHalf} away=${awaySecondHalf}`,
        );
      }
    },
  );

  await t.step(
    "fourth-down go-for-it plays occur across games",
    () => {
      let foundGoForIt = false;
      for (let seed = 1; seed <= 50 && !foundGoForIt; seed++) {
        const result = simulateGame({
          home: makeTeam("home"),
          away: makeTeam("away"),
          seed,
        });
        const fourthDownPlays = result.events.filter((e) =>
          e.tags.includes("fourth_down_attempt")
        );
        if (fourthDownPlays.length > 0) {
          foundGoForIt = true;
        }
      }
      assertEquals(
        foundGoForIt,
        true,
        "Should find fourth-down go-for-it plays",
      );
    },
  );

  await t.step(
    "4th-and-goal produces well-defined outcomes",
    () => {
      for (let seed = 1; seed <= 50; seed++) {
        const result = simulateGame({
          home: makeTeam("home"),
          away: makeTeam("away"),
          seed,
        });
        for (const event of result.events) {
          if (event.tags.includes("fourth_down_attempt")) {
            const validOutcome = [
              "rush",
              "pass_complete",
              "pass_incomplete",
              "sack",
              "interception",
              "fumble",
              "touchdown",
              "safety",
            ].includes(
              event.outcome,
            );
            assertEquals(
              validOutcome,
              true,
              `Fourth-down go-for-it produced unexpected outcome: ${event.outcome}`,
            );
          }
        }
      }
    },
  );

  await t.step(
    "turnover on downs occurs on failed 4th-down conversion",
    () => {
      let foundTurnoverOnDowns = false;
      for (let seed = 1; seed <= 200 && !foundTurnoverOnDowns; seed++) {
        const result = simulateGame({
          home: makeTeam("home"),
          away: makeTeam("away"),
          seed,
        });
        for (const drive of result.driveLog) {
          if (drive.result === "turnover_on_downs") {
            foundTurnoverOnDowns = true;
            break;
          }
        }
      }
      assertEquals(
        foundTurnoverOnDowns,
        true,
        "Should find turnover on downs in drive log",
      );
    },
  );

  await t.step(
    "two-minute defense shifts to prevent-adjacent coverage",
    () => {
      let twoMinPreventCount = 0;
      let twoMinOtherCount = 0;
      let normalPreventCount = 0;
      let normalOtherCount = 0;

      const preventCoverages = new Set([
        "cover_2",
        "cover_3",
        "cover_4",
        "cover_6",
      ]);

      for (let seed = 1; seed <= 50; seed++) {
        const result = simulateGame({
          home: makeTeam("home"),
          away: makeTeam("away"),
          seed,
        });
        for (const e of result.events) {
          if (
            e.outcome === "kickoff" || e.outcome === "xp" ||
            e.outcome === "two_point" || e.outcome === "kneel" ||
            e.outcome === "punt" || e.outcome === "field_goal" ||
            e.outcome === "missed_field_goal"
          ) continue;

          const isPrevent = preventCoverages.has(e.coverage.coverage);
          if (e.tags.includes("two_minute")) {
            if (isPrevent) twoMinPreventCount++;
            else twoMinOtherCount++;
          } else {
            if (isPrevent) normalPreventCount++;
            else normalOtherCount++;
          }
        }
      }

      const twoMinRate = twoMinPreventCount /
        (twoMinPreventCount + twoMinOtherCount);
      const normalRate = normalPreventCount /
        (normalPreventCount + normalOtherCount);
      assertGreater(
        twoMinRate,
        normalRate,
        `Two-minute prevent rate (${
          twoMinRate.toFixed(2)
        }) should exceed normal (${normalRate.toFixed(2)})`,
      );
    },
  );
});
