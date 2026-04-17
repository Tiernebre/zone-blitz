import { assertEquals } from "@std/assert";
import { DEFAULT_CITIES } from "./default-cities.ts";
import { DEFAULT_STATES } from "../states/default-states.ts";
import { DEFAULT_COLLEGES } from "../colleges/default-colleges.ts";

Deno.test("DEFAULT_CITIES has unique (name, stateCode) pairs", () => {
  const keys = DEFAULT_CITIES.map((c) => `${c.name}|${c.stateCode}`);
  assertEquals(new Set(keys).size, keys.length);
});

Deno.test("DEFAULT_CITIES all reference a known state code", () => {
  const known = new Set(DEFAULT_STATES.map((s) => s.code));
  for (const city of DEFAULT_CITIES) {
    assertEquals(
      known.has(city.stateCode),
      true,
      `city ${city.name} has unknown state ${city.stateCode}`,
    );
  }
});

Deno.test("DEFAULT_CITIES all have non-empty names", () => {
  for (const city of DEFAULT_CITIES) {
    assertEquals(city.name.length > 0, true);
  }
});

Deno.test("DEFAULT_CITIES covers every city referenced by a college", () => {
  const cityKeys = new Set(
    DEFAULT_CITIES.map((c) => `${c.name}|${c.stateCode}`),
  );
  for (const college of DEFAULT_COLLEGES) {
    const key = `${college.city}|${college.state}`;
    assertEquals(
      cityKeys.has(key),
      true,
      `college ${college.name} references uncovered city ${key}`,
    );
  }
});

Deno.test("DEFAULT_CITIES has at least 350 entries", () => {
  assertEquals(
    DEFAULT_CITIES.length >= 350,
    true,
    `expected >=350 cities, got ${DEFAULT_CITIES.length}`,
  );
});
