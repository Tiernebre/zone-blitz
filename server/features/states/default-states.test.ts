import { assertEquals } from "@std/assert";
import { DEFAULT_STATES } from "./default-states.ts";

Deno.test("DEFAULT_STATES has 51 entries (50 states + DC)", () => {
  assertEquals(DEFAULT_STATES.length, 51);
});

Deno.test("DEFAULT_STATES has unique codes", () => {
  const codes = DEFAULT_STATES.map((s) => s.code);
  assertEquals(new Set(codes).size, codes.length);
});

Deno.test("DEFAULT_STATES has unique names", () => {
  const names = DEFAULT_STATES.map((s) => s.name);
  assertEquals(new Set(names).size, names.length);
});

Deno.test("DEFAULT_STATES all have 2-letter uppercase codes", () => {
  const codeRegex = /^[A-Z]{2}$/;
  for (const state of DEFAULT_STATES) {
    assertEquals(
      codeRegex.test(state.code),
      true,
      `${state.name} has invalid code: ${state.code}`,
    );
  }
});

Deno.test("DEFAULT_STATES all use valid Census regions", () => {
  const validRegions = new Set(["Northeast", "Midwest", "South", "West"]);
  for (const state of DEFAULT_STATES) {
    assertEquals(
      validRegions.has(state.region),
      true,
      `${state.name} has invalid region: ${state.region}`,
    );
  }
});

Deno.test("DEFAULT_STATES all have non-empty fields", () => {
  for (const state of DEFAULT_STATES) {
    assertEquals(state.code.length, 2);
    assertEquals(state.name.length > 0, true);
    assertEquals(state.region.length > 0, true);
  }
});
