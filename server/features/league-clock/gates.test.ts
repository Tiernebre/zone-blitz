import { assertEquals } from "@std/assert";
import {
  computeNextStep,
  getGateForPhase,
  type LeagueGateState,
  resolveAutoBlockers,
  type TeamGateState,
} from "./gates.ts";
import { DEFAULT_PHASE_STEPS } from "./default-phase-steps.ts";
import { leaguePhaseEnum } from "./league-clock.schema.ts";

function createTeam(overrides: Partial<TeamGateState> = {}): TeamGateState {
  return {
    teamId: "team-1",
    isNpc: false,
    autoPilot: false,
    capCompliant: true,
    activeRosterCount: 53,
    rosterLimit: 53,
    ...overrides,
  };
}

function createState(
  overrides: Partial<LeagueGateState> = {},
): LeagueGateState {
  return {
    teams: [createTeam()],
    draftOrderResolved: true,
    superBowlPlayed: true,
    priorPhaseComplete: true,
    allTeamsHaveStaff: true,
    ...overrides,
  };
}

Deno.test("gates", async (t) => {
  await t.step("enterRegularSeason", async (t) => {
    const gate = getGateForPhase("regular_season")!;

    await t.step(
      "passes when all teams are cap-compliant and at roster limit",
      () => {
        const result = gate(createState({
          teams: [
            createTeam({ teamId: "t1" }),
            createTeam({ teamId: "t2" }),
          ],
        }));
        assertEquals(result, { ok: true });
      },
    );

    await t.step("blocks when a human team is not cap-compliant", () => {
      const result = gate(createState({
        teams: [
          createTeam({ teamId: "t1", capCompliant: false }),
          createTeam({ teamId: "t2" }),
        ],
      }));
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.blockers.length, 1);
        assertEquals(result.blockers[0].teamId, "t1");
        assertEquals(result.blockers[0].autoResolvable, false);
      }
    });

    await t.step("blocks when a team is not at roster limit", () => {
      const result = gate(createState({
        teams: [
          createTeam({ teamId: "t1", activeRosterCount: 50 }),
        ],
      }));
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.blockers.length, 1);
        assertEquals(
          result.blockers[0].reason,
          "Active roster is 50, must be 53",
        );
      }
    });

    await t.step("marks NPC team blockers as auto-resolvable", () => {
      const result = gate(createState({
        teams: [
          createTeam({ teamId: "t1", isNpc: true, capCompliant: false }),
        ],
      }));
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.blockers[0].autoResolvable, true);
      }
    });

    await t.step("marks autoPilot team blockers as auto-resolvable", () => {
      const result = gate(createState({
        teams: [
          createTeam({ teamId: "t1", autoPilot: true, capCompliant: false }),
        ],
      }));
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.blockers[0].autoResolvable, true);
      }
    });

    await t.step("produces multiple blockers for same team", () => {
      const result = gate(createState({
        teams: [
          createTeam({
            teamId: "t1",
            capCompliant: false,
            activeRosterCount: 45,
          }),
        ],
      }));
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.blockers.length, 2);
      }
    });
  });

  await t.step("enterDraft", async (t) => {
    const gate = getGateForPhase("draft")!;

    await t.step(
      "passes when prior phase complete and draft order resolved",
      () => {
        const result = gate(createState());
        assertEquals(result, { ok: true });
      },
    );

    await t.step("blocks when prior phase is not complete", () => {
      const result = gate(createState({ priorPhaseComplete: false }));
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.blockers[0].reason, "Prior phase is not complete");
      }
    });

    await t.step("blocks when draft order is not resolved", () => {
      const result = gate(createState({ draftOrderResolved: false }));
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(
          result.blockers[0].reason,
          "Draft order has not been resolved",
        );
      }
    });

    await t.step("produces two blockers when both conditions fail", () => {
      const result = gate(createState({
        priorPhaseComplete: false,
        draftOrderResolved: false,
      }));
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.blockers.length, 2);
      }
    });
  });

  await t.step("enterOffseasonRollover", async (t) => {
    const gate = getGateForPhase("offseason_rollover")!;

    await t.step("passes when Super Bowl has been played", () => {
      const result = gate(createState({ superBowlPlayed: true }));
      assertEquals(result, { ok: true });
    });

    await t.step("blocks when Super Bowl has not been played", () => {
      const result = gate(createState({ superBowlPlayed: false }));
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(
          result.blockers[0].reason,
          "Super Bowl has not been played",
        );
      }
    });
  });

  await t.step("enterInitialPool", async (t) => {
    const gate = getGateForPhase("initial_pool")!;

    await t.step("passes when all teams have staff", () => {
      const result = gate(createState({ allTeamsHaveStaff: true }));
      assertEquals(result, { ok: true });
    });

    await t.step("blocks when not all teams have staff", () => {
      const result = gate(createState({ allTeamsHaveStaff: false }));
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.blockers.length, 1);
        assertEquals(
          result.blockers[0].reason,
          "All teams must hire staff before generating the initial player pool",
        );
        assertEquals(result.blockers[0].autoResolvable, false);
      }
    });
  });

  await t.step("getGateForPhase returns undefined for ungated phases", () => {
    assertEquals(getGateForPhase("offseason_review"), undefined);
    assertEquals(getGateForPhase("coaching_carousel"), undefined);
    assertEquals(getGateForPhase("preseason"), undefined);
  });

  await t.step("resolveAutoBlockers", async (t) => {
    await t.step("returns empty arrays for ok result", () => {
      const { resolved, remaining } = resolveAutoBlockers({ ok: true });
      assertEquals(resolved, []);
      assertEquals(remaining, []);
    });

    await t.step(
      "separates auto-resolvable from non-resolvable blockers",
      () => {
        const { resolved, remaining } = resolveAutoBlockers({
          ok: false,
          blockers: [
            { teamId: "t1", reason: "npc", autoResolvable: true },
            { teamId: "t2", reason: "human", autoResolvable: false },
            { teamId: "t3", reason: "autopilot", autoResolvable: true },
          ],
        });
        assertEquals(resolved.length, 2);
        assertEquals(remaining.length, 1);
        assertEquals(remaining[0].teamId, "t2");
      },
    );
  });

  await t.step("computeNextStep", async (t) => {
    const phases = leaguePhaseEnum.enumValues;

    await t.step("advances within the same phase", () => {
      const next = computeNextStep(
        { phase: "offseason_review", stepIndex: 0 },
        DEFAULT_PHASE_STEPS,
        phases,
      );
      assertEquals(next, { phase: "offseason_review", stepIndex: 1 });
    });

    await t.step("advances to the next phase when at last step", () => {
      const next = computeNextStep(
        { phase: "offseason_review", stepIndex: 1 },
        DEFAULT_PHASE_STEPS,
        phases,
      );
      assertEquals(next, { phase: "coaching_carousel", stepIndex: 0 });
    });

    await t.step("returns null at the end of the last phase", () => {
      const rolloverSteps = DEFAULT_PHASE_STEPS.filter(
        (s) => s.phase === "offseason_rollover",
      );
      const maxStep = Math.max(...rolloverSteps.map((s) => s.stepIndex));
      const next = computeNextStep(
        { phase: "offseason_rollover", stepIndex: maxStep },
        DEFAULT_PHASE_STEPS,
        phases,
      );
      assertEquals(next, null);
    });

    await t.step("advances through draft rounds correctly", () => {
      const next = computeNextStep(
        { phase: "draft", stepIndex: 3 },
        DEFAULT_PHASE_STEPS,
        phases,
      );
      assertEquals(next, { phase: "draft", stepIndex: 4 });
    });

    await t.step("transitions from last draft round to udfa", () => {
      const next = computeNextStep(
        { phase: "draft", stepIndex: 6 },
        DEFAULT_PHASE_STEPS,
        phases,
      );
      assertEquals(next, { phase: "udfa", stepIndex: 0 });
    });

    await t.step("transitions from playoffs to offseason_rollover", () => {
      const next = computeNextStep(
        { phase: "playoffs", stepIndex: 3 },
        DEFAULT_PHASE_STEPS,
        phases,
      );
      assertEquals(next, { phase: "offseason_rollover", stepIndex: 0 });
    });

    await t.step(
      "walks through all 8 initial_staff_hiring steps before advancing",
      () => {
        for (let i = 0; i < 7; i++) {
          const next = computeNextStep(
            { phase: "initial_staff_hiring", stepIndex: i },
            DEFAULT_PHASE_STEPS,
            phases,
          );
          assertEquals(next, {
            phase: "initial_staff_hiring",
            stepIndex: i + 1,
          });
        }

        const afterFinalization = computeNextStep(
          { phase: "initial_staff_hiring", stepIndex: 7 },
          DEFAULT_PHASE_STEPS,
          phases,
        );
        assertEquals(afterFinalization, {
          phase: "initial_pool",
          stepIndex: 0,
        });
      },
    );

    await t.step(
      "walks through all 9 coaching_carousel steps before advancing",
      () => {
        for (let i = 0; i < 8; i++) {
          const next = computeNextStep(
            { phase: "coaching_carousel", stepIndex: i },
            DEFAULT_PHASE_STEPS,
            phases,
          );
          assertEquals(next, { phase: "coaching_carousel", stepIndex: i + 1 });
        }

        const afterFinalization = computeNextStep(
          { phase: "coaching_carousel", stepIndex: 8 },
          DEFAULT_PHASE_STEPS,
          phases,
        );
        assertEquals(afterFinalization, { phase: "tag_window", stepIndex: 0 });
      },
    );
  });
});
