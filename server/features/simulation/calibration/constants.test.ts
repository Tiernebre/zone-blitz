import { assertEquals } from "@std/assert/equals";
import {
  CALIBRATION_GAME_COUNT,
  K_MEAN,
  SPREAD_TOLERANCE,
  TAIL_SLACK_SD_MULTIPLIER,
  TEAM_GAME_TARGET,
} from "./constants.ts";

Deno.test("K_MEAN is 3.0", () => {
  assertEquals(K_MEAN, 3.0);
});

Deno.test("SPREAD_TOLERANCE is 0.25 (±25%)", () => {
  assertEquals(SPREAD_TOLERANCE, 0.25);
});

Deno.test("TAIL_SLACK_SD_MULTIPLIER is 0.5 SD", () => {
  assertEquals(TAIL_SLACK_SD_MULTIPLIER, 0.5);
});

Deno.test("TEAM_GAME_TARGET is 2688", () => {
  assertEquals(TEAM_GAME_TARGET, 2688);
});

Deno.test("CALIBRATION_GAME_COUNT is half of TEAM_GAME_TARGET", () => {
  assertEquals(CALIBRATION_GAME_COUNT, TEAM_GAME_TARGET / 2);
});
