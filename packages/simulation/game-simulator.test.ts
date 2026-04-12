import { assertEquals } from "@std/assert";
import { createGameSimulator } from "./game-simulator.ts";

Deno.test("game simulator", async (t) => {
  await t.step("simulate returns a result with scores and events", () => {
    const sim = createGameSimulator();
    const result = sim.simulate("team-a", "team-b");

    assertEquals(typeof result.homeScore, "number");
    assertEquals(typeof result.awayScore, "number");
    assertEquals(result.events.length > 0, true);
    assertEquals(result.events[0].quarter, 1);
  });
});
